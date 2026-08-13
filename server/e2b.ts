// e2b (e2b.dev) provider — optional cloud sandboxes for bots. Each bot can
// provision an isolated Linux sandbox via e2b when it needs remote compute.
// The Raspberry Pi remains the always-on harness host; e2b sandboxes are
// ephemeral/persistent compute for bots that need isolated environments.
//
// e2b facts (2026-08):
//   - Sandboxes are isolated Linux VMs with shell access
//   - Pause/resume preserves full memory state, paused sandboxes kept indefinitely
//   - SDK: `Sandbox.create()`, `.pause()`, `.connect()`, `.kill()`, `.commands.run()`
//   - Metadata-based discovery via `Sandbox.list({ query: { metadata: {...} } })`
//   - No built-in desktop/VNC — pure shell environment
//   - No native "run agent on sandbox" API — agents run on the Pi harness
import { Sandbox, type SandboxInfo } from "e2b";
import type { AppConfig } from "./config.ts";

const METADATA_KEY = "workspacealberta_bot_id";
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function e2bConfigured(cfg: AppConfig): boolean {
  return Boolean(cfg.e2b?.apiKey);
}

function getApiKey(cfg: AppConfig): string {
  const key = cfg.e2b?.apiKey;
  if (!key) {
    throw new Error(
      'e2b not configured — add {"e2b":{"apiKey":"e2b_…"}} to ~/.config/workspacealberta/config.json or set E2B_API_KEY'
    );
  }
  return key;
}

/** Find the bot's existing sandbox by metadata (running or paused). */
export async function findSandbox(
  cfg: AppConfig,
  botId: string
): Promise<SandboxInfo | null> {
  const apiKey = getApiKey(cfg);
  const paginator = Sandbox.list({
    apiKey,
    query: {
      state: ["running", "paused"],
      metadata: { [METADATA_KEY]: botId },
    },
  });
  const sandboxes = await paginator.nextItems();
  return sandboxes.length > 0 ? sandboxes[0] : null;
}

/** e2b sandbox status for the Computer panel. */
export async function sandboxStatus(cfg: AppConfig, botId: string) {
  if (!e2bConfigured(cfg)) return { configured: false, sandbox: null };
  try {
    const info = await findSandbox(cfg, botId);
    return {
      configured: true,
      sandbox: info
        ? {
            sandboxId: info.sandboxId,
            state: info.state ?? "unknown",
            templateId: info.templateId,
          }
        : null,
    };
  } catch (e) {
    return {
      configured: true,
      sandbox: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Find-or-create the bot's sandbox, wait for ready state, run idempotent
 * bootstrap (tmux welcome session), and return sandbox info.
 */
export async function provisionSandbox(
  cfg: AppConfig,
  botId: string,
  botName: string
): Promise<{
  sandboxId: string;
  reused: boolean;
  state: string;
}> {
  const apiKey = getApiKey(cfg);

  let info = await findSandbox(cfg, botId);
  let reused = true;
  let sandbox: Sandbox;

  if (info) {
    // Connect to existing sandbox (auto-resumes if paused)
    sandbox = await Sandbox.connect(info.sandboxId, {
      apiKey,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  } else {
    // Create new sandbox with auto-pause on timeout
    reused = false;
    sandbox = await Sandbox.create({
      apiKey,
      timeoutMs: DEFAULT_TIMEOUT_MS,
      metadata: { [METADATA_KEY]: botId },
      lifecycle: {
        onTimeout: "pause",
        autoResume: false,
      },
    });
  }

  // Idempotent bootstrap: ensure tmux session exists
  const safeName = botName.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 40);
  const bootstrap = [
    // Install tmux if not present
    "command -v tmux >/dev/null || (apt-get update -qq && apt-get install -y -qq tmux) || true",
    // Create a welcome tmux session
    `tmux has-session -t work 2>/dev/null || tmux new-session -d -s work 'echo; echo "  ▦ ${safeName}'"'"'s sandbox — WorkspaceAlberta"; echo; exec bash -i'`,
    "echo bootstrapped",
  ].join("\n");

  try {
    await sandbox.commands.run(bootstrap, { timeoutMs: 60_000 });
  } catch {
    // Bootstrap failure is non-fatal
  }

  const sandboxInfo = await sandbox.getInfo();
  return {
    sandboxId: sandbox.sandboxId,
    reused,
    state: sandboxInfo.state ?? "running",
  };
}

/** Wake the bot's sandbox (resume if paused). */
export async function joinSandbox(
  cfg: AppConfig,
  botId: string
): Promise<{ sandboxId: string; state: string }> {
  const apiKey = getApiKey(cfg);
  const info = await findSandbox(cfg, botId);
  if (!info) {
    throw new Error("no sandbox yet — provision it first");
  }
  const sandbox = await Sandbox.connect(info.sandboxId, {
    apiKey,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const sandboxInfo = await sandbox.getInfo();
  return {
    sandboxId: sandbox.sandboxId,
    state: sandboxInfo.state ?? "running",
  };
}

/** Pause the bot's sandbox (preserves state, releases compute). */
export async function pauseSandbox(
  cfg: AppConfig,
  botId: string
): Promise<{ ok: boolean }> {
  const apiKey = getApiKey(cfg);
  const info = await findSandbox(cfg, botId);
  if (!info) {
    throw new Error("no sandbox for this bot");
  }
  const sandbox = await Sandbox.connect(info.sandboxId, { apiKey });
  await sandbox.pause();
  return { ok: true };
}

/** Kill (permanently delete) the bot's sandbox. */
export async function killSandbox(
  cfg: AppConfig,
  botId: string
): Promise<{ ok: boolean }> {
  const apiKey = getApiKey(cfg);
  const info = await findSandbox(cfg, botId);
  if (!info) {
    throw new Error("no sandbox for this bot");
  }
  await Sandbox.kill(info.sandboxId, { apiKey });
  return { ok: true };
}

/** Run a shell command on the bot's sandbox. */
export async function execOnSandbox(
  cfg: AppConfig,
  botId: string,
  command: string
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  const apiKey = getApiKey(cfg);
  const info = await findSandbox(cfg, botId);
  if (!info) {
    throw new Error("no sandbox for this bot yet");
  }
  const sandbox = await Sandbox.connect(info.sandboxId, {
    apiKey,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const result = await sandbox.commands.run(String(command ?? "").slice(0, 4000), {
    timeoutMs: 120_000,
  });
  return {
    exitCode: result.exitCode ?? null,
    stdout: (result.stdout ?? "").slice(-4000),
    stderr: (result.stderr ?? "").slice(-2000),
  };
}

/** Run a command on a sandbox by ID (for computer-proxy use). */
export async function runCommand(
  cfg: AppConfig,
  sandboxId: string,
  command: string,
  { timeoutMs = 120_000 } = {}
): Promise<{ ok: boolean; exitCode: number | null; stdout: string; stderr: string }> {
  const apiKey = getApiKey(cfg);
  const sandbox = await Sandbox.connect(sandboxId, { apiKey });
  const result = await sandbox.commands.run(command, { timeoutMs });
  return {
    ok: result.exitCode === 0,
    exitCode: result.exitCode ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** Read a file from the sandbox (for screenshot retrieval). */
export async function readFile(
  cfg: AppConfig,
  sandboxId: string,
  path: string
): Promise<string | null> {
  const apiKey = getApiKey(cfg);
  try {
    const sandbox = await Sandbox.connect(sandboxId, { apiKey });
    const content = await sandbox.files.read(path);
    // e2b files.read returns Uint8Array for binary or string for text
    if (typeof content === "string") {
      return Buffer.from(content).toString("base64");
    }
    // Uint8Array case
    return Buffer.from(content).toString("base64");
  } catch {
    return null;
  }
}

// Screenshot: capture screen to a file, then read it back as base64.
// e2b sandboxes are pure Linux VMs — no X11/desktop by default.
// This attempts to capture if DISPLAY is set (unlikely in default e2b).
const SHOT_CMD = [
  "export DISPLAY=${DISPLAY:-:0}",
  "f=/tmp/ogb-panel.png",
  'scrot -o "$f" 2>/dev/null || import -window root "$f" 2>/dev/null || { echo "no_display"; exit 0; }',
  'command -v convert >/dev/null && convert "$f" -resize 1024x "$f" 2>/dev/null || true',
  'test -s "$f" && echo captured || echo no_capture',
].join("; ");

export async function screenshotSandbox(
  cfg: AppConfig,
  botId: string
): Promise<{ png: string; format: string }> {
  const apiKey = getApiKey(cfg);
  const info = await findSandbox(cfg, botId);
  if (!info) {
    throw new Error("no sandbox for this bot yet");
  }
  if (info.state === "paused") {
    throw new Error("sandbox is paused — resume it first");
  }
  const sandbox = await Sandbox.connect(info.sandboxId, { apiKey });
  const out = await sandbox.commands.run(SHOT_CMD, { timeoutMs: 60_000 });

  if (out.stdout?.includes("no_display")) {
    throw new Error(
      "e2b sandboxes have no graphical desktop by default — screenshot unavailable"
    );
  }
  if (!out.stdout?.includes("captured")) {
    throw new Error(
      out.stderr?.slice(0, 200) || "screen capture failed on the sandbox"
    );
  }

  const png = await readFile(cfg, info.sandboxId, "/tmp/ogb-panel.png");
  if (!png) {
    throw new Error("could not read the frame back from the sandbox");
  }
  return { png, format: "png" };
}
