// Built-in driver registration — upstream builtInDrivers.ts: a static
// array, nothing more. Adding a driver = write drivers/<x>.ts, append.
//
// WorkspaceAlberta matches upstream OpenMausBot: Claude/Codex are the
// default engines (Composio MCP is injected into those CLIs). Hugging Face
// and DeepSeek stay in the catalog as optional OpenAI-compatible inference.
// Note: Box agent driver removed in favor of e2b sandboxes (no equivalent
// "run agent on remote" API — agents run on the Pi harness, sandboxes
// provide isolated compute via shell commands).
import type { AnyProviderDriver } from "../contracts.ts";
import { ClaudeDriver } from "./claude.ts";
import { CodexDriver } from "./codex.ts";
import { DeepSeekDriver } from "./deepseek.ts";
import { GrokDriver } from "./grok.ts";
import { HuggingFaceDriver } from "./huggingface.ts";

export const BUILT_IN_DRIVERS: readonly AnyProviderDriver[] = [
  ClaudeDriver,
  CodexDriver,
  HuggingFaceDriver,
  DeepSeekDriver,
  GrokDriver,
];
