# WorkspaceAlberta Terminal

This is the **subscriber terminal** — the product SKU.

Every subscriber gets the same dedicated AI workspace. They pay Warre & Vavasour (Christian Cooper) to turn business plans into actual products, systems, or tools. The CanadaBuys MCP in [`HarleyCoops/WorkspaceAlberta`](https://github.com/HarleyCoops/WorkspaceAlberta) is a **showcase connector** of what this terminal can attach, not the product itself.

This directory is a new shell. It is not the leftover OpenMausBot-derived Electron chat in `src/`, `electron/`, and `server/` (`:5199` / `:8799`). It is not official DeepSeek Harness on `127.0.0.1:3080`.

## Shape

- Persistent teammates in a sidebar (Operator, Procurement, Builder — plus any you create).
- Each teammate has a role, memory, and tools.
- A local computer harness the agents actually use (`~/.config/workspacealberta/terminal/workspace`).
- MCP connectors only. The WorkspaceAlberta procurement MCP ships attached as the showcase.
- Approval gate before external MCP calls and computer commands.

## Run (Linux / Pi first)

From the repository root, after `pnpm install`:

```sh
pnpm terminal
```

That starts:

| Process | Bind | What it is |
|---------|------|------------|
| Terminal harness | `http://127.0.0.1:8899` | Teammates, MCP, computer, approvals |
| Terminal UI | `http://127.0.0.1:5299` | The subscriber shell |

Open `http://127.0.0.1:5299` in a desktop browser (Chromium on Pi is fine).

Separate processes if you need them:

```sh
pnpm terminal:server
pnpm terminal:ui
```

Smoke path (create teammate, send a message, list the showcase MCP, approval gate):

```sh
pnpm terminal:smoke
```

## How a subscriber sees the same shell

The seed is identical on every desk: Operator, Procurement, and Builder. Connectors and computer layout are the same. A subscriber does not get a custom chat app. They get this terminal. W&V work is what happens *through* the teammates, the local computer, and the MCP connectors you attach.

## Add the WorkspaceAlberta MCP (showcase)

The showcase URL is already attached:

```
https://elbowsupknivesout.warreandvavasour.com/mcp
```

To add it again, or point at another MCP:

1. Open the **Connectors** inspector.
2. Paste the Streamable HTTP URL (must be `http(s)://…`).
3. **Add and attach** — it binds to the selected teammate.
4. **List tools** to refresh the catalog (`tools/list`).
5. In the thread, ask the teammate to search tenders or run a computer command. External calls wait on the approval card.

You can also POST:

```sh
curl -sS -X POST http://127.0.0.1:8899/api/connectors \
  -H 'content-type: application/json' \
  --data '{"name":"WorkspaceAlberta MCP","url":"https://elbowsupknivesout.warreandvavasour.com/mcp"}'
```

## What this is not

- Not the leftover Telegram-style Electron chat (`pnpm start`).
- Not a `.deb` / GitHub Release. This repo has none yet. Run from source.
- Not official `@deepseek-ai/dsh` and not Raspberry Pi / DSH internals.
- Not a second tool mesh. Plugins here are MCP connectors.

## Data

| | |
|--|--|
| State | `~/.config/workspacealberta/terminal/state.json` |
| Computer workspace | `~/.config/workspacealberta/terminal/workspace/` |
| Override home | `WA_TERMINAL_HOME` |
| Override port | `WA_TERMINAL_PORT` (default `8899`) |
| Override showcase URL | `WA_SHOWCASE_MCP_URL` |
