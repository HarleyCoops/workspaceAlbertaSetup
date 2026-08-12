import { BoxAgentDriver } from "./boxagent.js";
import { ClaudeDriver } from "./claude.js";
import { CodexDriver } from "./codex.js";
import { GrokDriver } from "./grok.js";
import { HuggingFaceDriver } from "./huggingface.js";
export const BUILT_IN_DRIVERS = [
    HuggingFaceDriver, // Primary: open-source models for WorkspaceAlberta
    GrokDriver,
    ClaudeDriver,
    CodexDriver,
    BoxAgentDriver,
];
