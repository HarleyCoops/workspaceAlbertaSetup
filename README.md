<div align="center">

# WorkspaceAlberta

**Subscriber terminal — the same dedicated AI workspace on every desk**

Subscribers pay Warre & Vavasour (Christian Cooper) to turn business plans into
actual products, systems, or tools. The product they sit in is **WorkspaceAlberta Terminal**:
persistent teammates, a local computer, MCP connectors, and an approval gate.

The CanadaBuys MCP in [`HarleyCoops/WorkspaceAlberta`](https://github.com/HarleyCoops/WorkspaceAlberta)
(`https://elbowsupknivesout.warreandvavasour.com/mcp`) is a **showcase connector**, not the SKU.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-38d591)

<br>

</div>

---

## Subscriber terminal (the SKU)

Every subscriber gets this same shell. Source lives in [`terminal/`](terminal/) so it does not collide
with the leftover OpenMausBot-derived Electron chat.

```sh
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git
cd workspaceAlbertaSetup
pnpm install
pnpm terminal
```

Then open **`http://127.0.0.1:5299`**.

| Process | Bind | Notes |
|---------|------|-------|
| Terminal harness | `127.0.0.1:8899` | Teammates, MCP, local computer, approvals |
| Terminal UI | `127.0.0.1:5299` | The subscriber surface |

```sh
pnpm terminal:smoke    # create teammate, send a message, list showcase MCP, approval gate
pnpm terminal:server   # harness only
pnpm terminal:ui       # Vite only
```

Full subscriber notes: [`terminal/README.md`](terminal/README.md).

**Smoke path in the UI**

1. Open or create a teammate in the sidebar (Operator / Procurement / Builder are seeded).
2. Send a message.
3. Ask to **list the showcase MCP**, or click **List tools** on the WorkspaceAlberta connector.
4. Ask to **show approval gate** or **run echo hello** — Allow / Deny the card before the computer or an external MCP call runs.

**Add the WorkspaceAlberta MCP URL**

The showcase connector is already attached. To add it (or another Streamable HTTP MCP) yourself:
Connectors inspector → paste `https://elbowsupknivesout.warreandvavasour.com/mcp` → Add and attach.

**How a subscriber sees the same shell**

The seed teammates, inspector (role / memory / tools / computer / connectors), and approval gate
are identical on every desk. W&V work is what happens *through* that shared terminal — not a
custom chat app per subscriber, and not the MCP endpoint as the product.

This repo currently has **zero GitHub Releases**. There is no `.deb` to download. Run from source.

---

## Start Here

This repository is also the **setup home** for WorkspaceAlberta CEO desks (Pi installer, leftover
chat, companion firmware). Those are not the subscriber SKU.

| What | Where |
|------|-------|
| **Subscriber terminal (SKU)** | [`terminal/`](terminal/) — `pnpm terminal` |
| **Pi first-boot installer** | [`installer/install-ceo-pi.sh`](installer/install-ceo-pi.sh) |
| **Beginner's Pi guide** | [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md) |
| **Installer reference** | [`docs/ceo-pi-setup.md`](docs/ceo-pi-setup.md) |
| **Remote support runbook** | [`docs/tailscale-pi-remote-support.md`](docs/tailscale-pi-remote-support.md) |
| **Litter mobile support** | [`docs/litter-remote-support.md`](docs/litter-remote-support.md) |
| **Handheld companion** | [`docs/handheld-companion.md`](docs/handheld-companion.md) (full spec) · V2 experiment: [`firmware/companion/README.md`](firmware/companion/README.md) |
| **Leftover OpenMausBot chat** | `src/` + `electron/` + `server/` on `:5199` / `:8799` — **not the SKU** |
| **Leftover chat UI reference** | [`docs/ui-resources.md`](docs/ui-resources.md) |

**Related:** The procurement MCP **showcase** (CanadaBuys / Alberta agents) lives in [`HarleyCoops/WorkspaceAlberta`](https://github.com/HarleyCoops/WorkspaceAlberta). Do not treat that MCP as the product.

---

## What is WorkspaceAlberta?

WorkspaceAlberta is the **subscriber terminal**: a team of named AI teammates, a local computer
they can use, MCP connectors, and approvals before destructive or external work. Every subscriber
gets the same sleek dedicated workspace. Warre & Vavasour is paid to turn a business plan into a
working product, system, or tool inside that shell.

> **Naming note:** The *product* is **WorkspaceAlberta**. This repository (`workspaceAlbertaSetup`)
> hosts the subscriber terminal plus desk setup. Official DeepSeek Harness (`dsh web` on
> `127.0.0.1:3080`) is a separate installed CLI — do not bounce or replace it. Raspberry Pi / DSH
> internals belong to RaspberryPiBot, not this track.

**What the terminal is (and is not):**

- **MCP connectors** — start with the WorkspaceAlberta showcase URL. Do not invent a second tool mesh.
- **Linux / Pi first** — run the web shell on Raspberry Pi 5 desks and Linux workstations.
- **Local harness** — `127.0.0.1:8899` owns teammates, transcripts, and the computer workspace under
  `~/.config/workspacealberta/terminal`.
- **Not the leftover chat** — the OpenMausBot-derived Electron app (`pnpm start`) stays in the tree
  but is not what subscribers buy.

---

## Quick Start: Pi Terminal Setup

**New to Raspberry Pi?** Follow the complete guide: [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md)

**Already have a Pi running Ubuntu/Raspberry Pi OS?** Run the installer:

```sh
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git ~/workspaceAlbertaSetup
cd ~/workspaceAlbertaSetup
chmod +x installer/install-ceo-pi.sh
./installer/install-ceo-pi.sh
```

This installs:
- **Tailscale** for remote support
- **Node.js 22** (NodeSource) and **DeepSeek Harness** (`@deepseek-ai/dsh`)
- **Codex CLI + Claude Code + ChatGPT Desktop** (Linux arm64 `.deb`) for AI-assisted work
- **OpenCode / OpenCode2** for MCP agent workflows
- **WorkspaceAlberta Terminal** from this repo: `pnpm terminal` (subscriber SKU). The leftover Electron chat is `pnpm start` if you still need it.
- **1Password** (optional) for credential management

First-boot details that the 2026-08-14/15 unbox was missing (27W PSU, `/usr/bin/node`, `dsh web` on `127.0.0.1:3080`, dedicated Windows SSH key) live in [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md).

---

## Leftover OpenMausBot chat (not the SKU)

The Telegram-style Electron app in `src/`, `electron/`, and `server/` is leftover OpenMausBot
infrastructure. It remains runnable. It is **not** the subscriber terminal.

There are **no GitHub Releases** and no installable `.deb` in this repo today. Do not wget a
fictional `workspacealberta_*.deb`.

### From Source (leftover chat only)

```sh
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup && cd workspaceAlbertaSetup
pnpm install
pnpm start
```

`pnpm start` launches the leftover harness (`127.0.0.1:8799`), Vite (`127.0.0.1:5199`), and Electron.
That is a different surface from `pnpm terminal`. A black Electron window usually means Vite is not up yet.

On Linux/Pi the start path sets `ELECTRON_DISABLE_SANDBOX=1` and passes `--no-sandbox` (chrome-sandbox SUID errors). It also sets `ELECTRON_DISABLE_GPU=1` as a GPU fallback; unset that env var if your desktop GPU works.

If **pnpm 11** blocks `electron` / `esbuild` postinstall scripts:

```sh
pnpm config set dangerouslyAllowAllBuilds true
pnpm install
```

Requirements: **Node 20+**, **pnpm**. Live TypeScript (`pnpm start` / `pnpm dev:server`) needs **Node 22+**. DeepSeek Harness (`dsh`) needs **Node 22.19+ or 24+**. On Ubuntu Desktop, terminals can pick up an older Node on `PATH` — use `/usr/bin/node` and `/usr/bin/npm` after NodeSource. Do not treat an npm 12 upgrade as a required step. On Node 20 run `pnpm build:server` first — `pnpm start` will use `dist-server/`.

Individual processes (if you need them separately):

```sh
pnpm dev:server    # harness server → 127.0.0.1:8799
pnpm dev           # app → http://127.0.0.1:5199
pnpm dev:desktop   # Electron shell (expects Vite already on 5199)
```

### Building Packages

```sh
pnpm typecheck     # Verify TypeScript
pnpm build         # Build UI + server

# Linux packages
pnpm package:linux          # AppImage + deb for x64
pnpm package:linux:arm64    # AppImage + deb for arm64 (Pi)
pnpm package:pi             # Just the arm64 deb

# macOS (requires macOS + Xcode)
pnpm package:mac
```

---

## Leftover chat configuration

These keys belong to the leftover OpenMausBot Electron app, not the subscriber terminal.

### Claude / Codex (default — required for the leftover tool mesh)

Upstream OpenMausBot has no Hugging Face driver. Tools are a property of CLI/ACP engines:
Composio Connect is passed to Claude and Codex as streamable HTTP MCP
(`connect.composio.dev` + `x-consumer-api-key`). New bots follow the same preference:
**Claude → Codex → Hugging Face**.

| Provider | Install | Notes |
|----------|---------|-------|
| Claude Code (default) | `npm i -g @anthropic-ai/claude-code` | Run `claude` once to sign in |
| Codex | `npm i -g @openai/codex` | OpenAI Codex CLI |

These appear automatically in the model picker when installed.

### Optional: Hugging Face

Open-source inference via Hugging Face Inference Providers. Catalog default is **GLM 4.6**
(`zai-org/GLM-4.6` on the router; GLM 4.7, Llama, Qwen, etc. remain in the picker).
HF is optional text inference — it is not the boot default.

1. Get a token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Paste it in App Settings → "Hugging Face token"

**Custom endpoints:** App Settings → "Hugging Face base URL", or `HF_BASE_URL`.

### Optional: DeepSeek

Paid OpenAI-compatible fallback (`deepseek-v4-pro` / `deepseek-v4-flash`). Paste a key in
App Settings, or set `DEEPSEEK_API_KEY`. Not the boot default.

This in-app driver is **separate** from the official DeepSeek Harness CLI (`@deepseek-ai/dsh`,
binary `/usr/bin/dsh`). Launch `dsh web` in the Ubuntu Terminal (binds `http://127.0.0.1:3080`)
and paste a key in that UI's Settings → Models. See [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md).

### Optional: Connected Apps

Paste credentials in **App Settings** to unlock additional features:

| Key | Unlocks |
|-----|---------|
| Composio Connect key (`ck_…`) | Gmail, Drive, Slack, GitHub via Claude/Codex MCP (required path for the tool mesh) |
| DeepSeek API key | Optional paid inference (`deepseek-v4-pro`) |
| e2b API key (`e2b_…`) | Cloud sandboxes for your bots (isolated Linux environments) |

---

## System Requirements

### Raspberry Pi (Primary Target)

- **Raspberry Pi 5** with 8GB or 16GB RAM (16GB recommended)
- **Ubuntu Desktop 24.04 LTS** (arm64) or Raspberry Pi OS (64-bit)
- Active internet connection for Hugging Face API

### Linux Desktop

- **Ubuntu 22.04+**, Debian 12+, or equivalent
- 4GB RAM minimum (8GB+ recommended)
- x64 or arm64 architecture

### macOS (Secondary)

- macOS 12+ (Monterey or later)
- Apple Silicon or Intel

---

## Leftover chat architecture (not the SKU)

The subscriber terminal architecture is in [`terminal/README.md`](terminal/README.md) (UI `:5299`, harness `:8899`). The leftover OpenMausBot chat is still two processes:

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron / Browser UI (React + Tailwind)                       │
│  - Chat interface, model picker, computer panel                 │
│  - Dispatches commands over HTTP                                │
│  - Folds one SSE event stream into state                        │
│  - Visual reference: Beautiful UI (see docs/ui-resources.md)    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP + SSE
┌───────────────────────────▼─────────────────────────────────────┐
│  Harness Server (127.0.0.1:8799)                                │
│  - Driver registry: Claude CLI + Codex CLI (default / tools),   │
│    optional HF + DeepSeek inference                             │
│  - Event bus normalizes all provider protocols                  │
│  - Permission broker for tool approvals                         │
│  - Transcript storage in ~/.config/workspacealberta             │
│  - Optional e2b sandbox integration for isolated compute        │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** The Raspberry Pi is the always-on host for the WorkspaceAlberta harness.
e2b sandboxes are **optional** — they provide isolated Linux environments for bots
that need remote compute, but are not required for basic operation.

### Adding a Provider

The driver SPI is intentionally small. Adding a provider:

1. Create `server/drivers/<name>.ts` (see `grok.ts` or `huggingface.ts` as examples)
2. Register in `server/drivers/builtIn.ts`
3. Add icon in `src/components/ProviderIcons.tsx`

---

## Data Storage

| Platform | Location |
|----------|----------|
| Linux | `~/.config/workspacealberta/` (XDG) or `~/.workspacealberta/` |
| macOS | `~/.workspacealberta/` |

Contents:
- `config.json` — API keys (write-only, never echoed to UI)
- `bots.json` — Bot records and resume cursors
- `messages-<threadId>.json` — Transcripts per thread
- `events/` — Raw provider event logs (NDJSON)

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `HF_TOKEN` | Hugging Face API token | — |
| `HF_BASE_URL` | Custom HF inference endpoint | `https://router.huggingface.co/v1` |
| `DEEPSEEK_API_KEY` | DeepSeek API key (optional fallback) | — |
| `DEEPSEEK_BASE_URL` | DeepSeek API base URL | `https://api.deepseek.com` |
| `WA_PORT` | Server port | `8799` |
| `WA_ANALYTICS` | Opt-in to telemetry (`1` to enable) | disabled |
| `E2B_API_KEY` | e2b sandbox API key (optional) | — |
| `COMPOSIO_KEY` | Composio Connect key | — |
| `ELECTRON_DISABLE_GPU` | Set by `pnpm start` on Linux; unset to use GPU | `1` on Linux start |

---

## License

MIT — see [LICENSE](LICENSE).

Based on [OpenMausBot](https://github.com/milind-soni/OpenMausBot) by Milind Soni.

---

## Contributing

Contributions welcome! The driver SPI in [`server/contracts.ts`](server/contracts.ts) is
deliberately small. See the existing drivers in [`server/drivers/`](server/drivers/) for examples.

When changing the chat or harness UI, treat [Beautiful UI](https://www.beautifului.dev/) as the
primitive reference — see [`docs/ui-resources.md`](docs/ui-resources.md). Do not rewrite the app,
do not add a Beautiful UI dependency, and do not replace Composio Connect (the tool mesh stays
MCP into Claude Code / Codex CLI). The [DeepSeek Harness](https://github.com/HarleyCoops/deepseek-Entire.io)
uses the same reference so the two surfaces stay visually aligned.

---

<div align="center">

**WorkspaceAlberta Terminal** — the subscriber shell. MCP is a showcase connector.

</div>
