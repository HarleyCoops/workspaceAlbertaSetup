// Built-in driver registration — upstream builtInDrivers.ts: a static
// array, nothing more. Adding a driver = write drivers/<x>.ts, append.
//
// WorkspaceAlberta: Hugging Face is listed first as the primary provider
// for the Linux/Pi appliance. Claude/Codex remain for power users.
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
  HuggingFaceDriver, // Primary: open-source models for WorkspaceAlberta
  DeepSeekDriver, // Optional paid fallback when DEEPSEEK_API_KEY is set
  GrokDriver,
  ClaudeDriver,
  CodexDriver,
];
