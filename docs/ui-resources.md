# UI Resources

Visual and interaction reference for the **leftover** WorkspaceAlberta chat harness (React + Electron
in `src/`). That leftover app is not the subscriber SKU.

The subscriber terminal is [`terminal/`](../terminal/). Do not restyle the leftover Electron chat
and call it the product.

These catalogs are **references only** — do not vendor them, add them as a dependency, or restyle the leftover app to match.

---

## Beautiful UI

**Link:** [https://www.beautifului.dev/](https://www.beautifului.dev/)

Crafted primitives for AI-native interfaces.

### When to use

Changing leftover chat or leftover harness UI only: loading state, thinking traces, streaming text, approval cards, tool chips, task rows, chat, prompt bar, recommendation cards, context cards, sidebar nav, insight cards, code block, selection actions. For the subscriber terminal, edit `terminal/`.

### What not to do

| Do not | Keep |
|--------|------|
| Rewrite or restyle the app to match the catalog | The existing WorkspaceAlberta chat shell |
| Add a `beautifului` dependency or vendor the library | Beautiful UI as a visual/interaction reference |
| Replace Composio or invent a second tool mesh | Composio Connect as MCP into Claude Code / Codex CLI |
| Restyle the leftover Electron chat and call it the SKU | Subscriber shell lives in `terminal/` |

### Sister harness

[DeepSeek Harness](https://github.com/HarleyCoops/deepseek-Entire.io) uses the same UI reference so the two surfaces stay visually aligned.
