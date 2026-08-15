import { ClaudeDriver } from "./claude.js";
import { CodexDriver } from "./codex.js";
import { DeepSeekDriver } from "./deepseek.js";
import { GrokDriver } from "./grok.js";
import { HuggingFaceDriver } from "./huggingface.js";
export const BUILT_IN_DRIVERS = [
    HuggingFaceDriver, // Primary: open-source models for WorkspaceAlberta
    DeepSeekDriver, // Optional paid fallback when DEEPSEEK_API_KEY is set
    GrokDriver,
    ClaudeDriver,
    CodexDriver,
];
