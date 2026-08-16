# UI Resources

Visual and interaction reference for the WorkspaceAlberta chat harness (React + Electron).
These catalogs are **references only** — do not vendor them, add them as a dependency, or restyle the app to match.

---

## Beautiful UI

**Link:** [https://www.beautifului.dev/](https://www.beautifului.dev/)

Crafted primitives for AI-native interfaces.

### When to use

Changing chat or harness UI: loading state, thinking traces, streaming text, approval cards, tool chips, task rows, chat, prompt bar, recommendation cards, context cards, sidebar nav, insight cards, code block, selection actions.

### What not to do

| Do not | Keep |
|--------|------|
| Rewrite or restyle the app to match the catalog | The existing WorkspaceAlberta chat shell |
| Add a `beautifului` dependency or vendor the library | Beautiful UI as a visual/interaction reference |
| Replace Composio or invent a second tool mesh | Composio Connect as MCP into Claude Code / Codex CLI |
| Invent a second chat shell | One harness UI, shared with the sister surface |

### Sister harness

[DeepSeek Harness](https://github.com/HarleyCoops/deepseek-Entire.io) uses the same UI reference so the two surfaces stay visually aligned.
