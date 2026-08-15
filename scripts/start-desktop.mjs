#!/usr/bin/env node
// One-command desktop launch: harness server + Vite + Electron.
// Waits for Vite (and the harness) before opening the window so unpackaged
// Electron does not load a black 127.0.0.1:5199 page.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VITE_URL = process.env.ELECTRON_START_URL ?? "http://127.0.0.1:5199";
const SERVER_HEALTH = `http://127.0.0.1:${process.env.WA_PORT || process.env.OMB_PORT || process.env.OGB_PORT || 8799}/api/health`;

export function electronEnv(base = process.env, platform = process.platform) {
  const env = { ...base };
  if (platform === "linux") {
    env.ELECTRON_DISABLE_SANDBOX = "1";
    // Fallback for Pi / headless Linux where GPU compositing fails.
    if (env.ELECTRON_DISABLE_GPU === undefined) env.ELECTRON_DISABLE_GPU = "1";
  }
  return env;
}

export function electronArgs(env = process.env, platform = process.platform) {
  const args = ["."];
  if (platform === "linux") args.push("--no-sandbox");
  if (env.ELECTRON_DISABLE_GPU === "1") args.push("--disable-gpu");
  return args;
}

export async function waitForHttp(url, { timeoutMs = 60_000, intervalMs = 250, required = true } = {}) {
  const start = Date.now();
  let lastError = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return true;
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  if (required) throw new Error(`Timed out waiting for ${url}${lastError ? ` (${lastError})` : ""}`);
  return false;
}

function spawnChild(command, args, env) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  });
  child.on("error", (err) => {
    console.error(`[start] failed to spawn ${command}:`, err.message);
  });
  return child;
}

async function main() {
  if (process.argv.includes("--print-env")) {
    const env = electronEnv();
    console.log(
      JSON.stringify(
        {
          platform: process.platform,
          ELECTRON_DISABLE_SANDBOX: env.ELECTRON_DISABLE_SANDBOX ?? null,
          ELECTRON_DISABLE_GPU: env.ELECTRON_DISABLE_GPU ?? null,
          args: electronArgs(env),
        },
        null,
        2,
      ),
    );
    return;
  }

  const env = electronEnv();
  const children = [];
  let shuttingDown = false;

  const shutdown = (code = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const child of children) {
      if (child.exitCode === null && !child.killed) {
        try {
          child.kill("SIGTERM");
        } catch {
          /* already gone */
        }
      }
    }
    process.exit(code);
  };

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  console.log("[start] harness server → 127.0.0.1:8799");
  children.push(spawnChild("pnpm", ["dev:server"], env));
  console.log("[start] Vite UI → 127.0.0.1:5199");
  children.push(spawnChild("pnpm", ["dev"], env));

  try {
    await waitForHttp(VITE_URL, { timeoutMs: 90_000 });
    console.log("[start] Vite is up");
  } catch (e) {
    console.error(`[start] ${e instanceof Error ? e.message : e}`);
    console.error("[start] A black Electron window usually means Vite never bound 127.0.0.1:5199.");
    shutdown(1);
    return;
  }

  const serverUp = await waitForHttp(SERVER_HEALTH, { timeoutMs: 30_000, required: false });
  if (serverUp) {
    console.log("[start] harness server is up");
  } else {
    console.warn(`[start] harness server did not answer ${SERVER_HEALTH} — opening Electron anyway`);
  }

  let electronBin;
  try {
    electronBin = require("electron");
  } catch {
    console.error("[start] electron is not installed — run pnpm install");
    shutdown(1);
    return;
  }

  const args = electronArgs(env);
  console.log(`[start] Electron ${args.join(" ")}`);
  const electron = spawnChild(electronBin, args, env);
  children.push(electron);
  electron.on("exit", (code) => shutdown(code ?? 0));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
