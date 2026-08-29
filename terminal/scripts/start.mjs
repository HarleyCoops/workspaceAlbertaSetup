#!/usr/bin/env node
// Launch the subscriber terminal: harness :8899 + Vite :5299.
// Does not start leftover Electron chat (:5199/:8799) or official DSH (:3080).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = process.env.WA_TERMINAL_PORT || "8899";
const UI = process.env.WA_TERMINAL_UI_PORT || "5299";
const HEALTH = `http://127.0.0.1:${PORT}/api/health`;
const UI_URL = `http://127.0.0.1:${UI}`;

async function waitForHttp(url, timeoutMs = 60_000) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}${last ? ` (${last})` : ""}`);
}

const children = [];
const shutdown = (code = 0) => {
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

const env = { ...process.env, WA_TERMINAL_PORT: PORT };
console.log("[terminal] WorkspaceAlberta Terminal — subscriber SKU");
console.log(`[terminal] harness → ${HEALTH}`);
const server = spawn(process.execPath, ["--experimental-strip-types", "terminal/server/index.ts"], {
  cwd: root,
  env,
  stdio: "inherit",
});
children.push(server);

console.log(`[terminal] UI → ${UI_URL}`);
const vite = spawn("pnpm", ["exec", "vite", "--config", "terminal/vite.config.ts", "--port", UI, "--host", "127.0.0.1"], {
  cwd: root,
  env,
  stdio: "inherit",
});
children.push(vite);

server.on("exit", (code) => {
  if (code && code !== 0) shutdown(code);
});
vite.on("exit", (code) => {
  if (code && code !== 0) shutdown(code ?? 1);
});

try {
  await waitForHttp(HEALTH);
  await waitForHttp(UI_URL);
  console.log(`[terminal] open ${UI_URL}`);
  console.log("[terminal] leftover OpenMausBot chat is not this product (that is pnpm start on :5199/:8799)");
} catch (err) {
  console.error(`[terminal] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
}
