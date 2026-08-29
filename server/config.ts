// Config + data dirs. One file, ~/.workspacealberta/config.json, env fallbacks:
//   { "hf": {"key":"hf_…"}, "deepseek": {"key":"sk-…"}, "xai": {"key":"xai-…"}, "composio": {"key":"ck_…"},
//     "instances": { "<instanceId>": {"driver":"huggingface", …} } }
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, chmodSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

import type { InstanceConfigMap } from "./contracts.ts";

export interface AppConfig {
  hf?: { key?: string; url?: string };
  xai?: { key?: string; url?: string };
  deepseek?: { key?: string; url?: string };
  /** key = ck_… Connect consumer key (connections + agent tools);
   * apiKey = ak_… project API key — optional, unlocks the full toolkit
   * catalog with official logos in the plugins marketplace. */
  composio?: { key?: string; apiKey?: string; url?: string };
  /** e2b sandbox API key — optional, enables cloud sandboxes for bots. */
  e2b?: { apiKey?: string };
  /** Cohere API key — optional, enables Command A+ bid-room review inside e2b. */
  cohere?: { apiKey?: string };
  instances?: InstanceConfigMap;
}

// Platform-aware data directory:
// - Linux: ~/.config/workspacealberta (XDG) or ~/.workspacealberta
// - macOS: ~/.workspacealberta (simpler, no Library paths needed for harness)
function resolveDataDir(): string {
  const isLinux = platform() === "linux";
  if (isLinux) {
    const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
    return join(xdgConfig, "workspacealberta");
  }
  return join(homedir(), ".workspacealberta");
}

export const DATA_DIR = resolveDataDir();

// Legacy directories to migrate from (in priority order)
const LEGACY_DATA_DIRS = [
  join(homedir(), ".openmausbot"),
  join(homedir(), ".opengrokbot"),
  // On Linux, also check old non-XDG location if we're now using XDG
  ...(platform() === "linux" && process.env.XDG_CONFIG_HOME
    ? [join(homedir(), ".workspacealberta")]
    : []),
];

export const EVENTS_DIR = join(DATA_DIR, "events");
export const NATIVE_DIR = join(DATA_DIR, "native");

export function ensureDirs() {
  // one-time migration from pre-rename data dirs — bots, transcripts,
  // config and keys all carry over
  if (!existsSync(DATA_DIR)) {
    for (const legacyDir of LEGACY_DATA_DIRS) {
      if (existsSync(legacyDir)) {
        try {
          renameSync(legacyDir, DATA_DIR);
          console.log(`Migrated data from ${legacyDir} to ${DATA_DIR}`);
          break;
        } catch {
          /* cross-device or busy — fall through to a fresh dir */
        }
      }
    }
  }
  for (const dir of [DATA_DIR, EVENTS_DIR, NATIVE_DIR]) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): AppConfig {
  let cfg: AppConfig = {};
  try {
    cfg = JSON.parse(readFileSync(join(DATA_DIR, "config.json"), "utf8"));
  } catch {
    /* first run — env fallbacks below */
  }
  // Environment variable fallbacks (WA_* preferred, OMB_*/OGB_* for compat)
  cfg.hf = { key: process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN, ...cfg.hf };
  cfg.xai = { key: process.env.XAI_API_KEY, ...cfg.xai };
  cfg.deepseek = {
    key: process.env.DEEPSEEK_API_KEY,
    url: process.env.DEEPSEEK_BASE_URL,
    ...cfg.deepseek,
  };
  cfg.composio = { key: process.env.COMPOSIO_KEY, ...cfg.composio };
  cfg.e2b = { apiKey: process.env.E2B_API_KEY, ...cfg.e2b };
  cfg.cohere = { apiKey: process.env.COHERE_API_KEY, ...cfg.cohere };
  return cfg;
}

/** Merge a partial config into ~/.workspacealberta/config.json (secrets never
 * echoed back — callers report configured-or-not booleans only). */
export function saveConfig(patch: Partial<AppConfig>): void {
  const p = join(DATA_DIR, "config.json");
  let disk: Record<string, unknown> = {};
  try {
    disk = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    /* first write */
  }
  for (const key of ["hf", "xai", "deepseek", "composio", "e2b", "cohere"] as const) {
    if (patch[key] && typeof patch[key] === "object") {
      disk[key] = { ...(disk[key] as object), ...patch[key] };
    }
  }
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(p, JSON.stringify(disk, null, 2), { mode: 0o600 });
  chmodSync(p, 0o600);
}

/** Return write-only credential status; secret values are never serialized. */
export function configStatus(cfg: AppConfig) {
  return {
    hf: { configured: Boolean(cfg.hf?.key) },
    xai: { configured: Boolean(cfg.xai?.key) },
    deepseek: { configured: Boolean(cfg.deepseek?.key) },
    composio: {
      configured: Boolean(cfg.composio?.key),
      apiKeyConfigured: Boolean(cfg.composio?.apiKey),
    },
    e2b: { configured: Boolean(cfg.e2b?.apiKey) },
    cohere: { configured: Boolean(cfg.cohere?.apiKey) },
  };
}

// Default fleet matches upstream: Claude/Codex first (tool mesh), then
// optional OpenAI-compatible inference (Hugging Face, DeepSeek).
// Config-file keys are injected as per-instance environment so drivers
// see them without needing real process env vars.
export function instanceConfigs(cfg: AppConfig): InstanceConfigMap {
  const map: InstanceConfigMap =
    cfg.instances && Object.keys(cfg.instances).length
      ? cfg.instances
      : {
          claude: { driver: "claudeAgent" },
          codex: { driver: "codex" },
          huggingface: { driver: "huggingface" },
          deepseek: {
            driver: "deepseek",
            ...(cfg.deepseek?.url ? { config: { url: cfg.deepseek.url } } : {}),
          },
        };
  for (const entry of Object.values(map)) {
    entry.environment = {
      ...(cfg.hf?.key ? { HF_TOKEN: cfg.hf.key } : {}),
      ...(cfg.xai?.key ? { XAI_API_KEY: cfg.xai.key } : {}),
      ...(cfg.deepseek?.key ? { DEEPSEEK_API_KEY: cfg.deepseek.key } : {}),
      ...(cfg.e2b?.apiKey ? { E2B_API_KEY: cfg.e2b.apiKey } : {}),
      ...(cfg.cohere?.apiKey ? { COHERE_API_KEY: cfg.cohere.apiKey } : {}),
      ...entry.environment,
    };
  }
  return map;
}
