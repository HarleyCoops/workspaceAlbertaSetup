<div align="center">

# WorkspaceAlberta

**Linux-first CEO productivity chat app with AI bots**

A team of AI bots in a messaging interface, powered by open-source models from Hugging Face.
Built for Raspberry Pi desk terminals and Linux workstations.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Electron](https://img.shields.io/badge/Electron-Linux%20%7C%20macOS-2B2E3A?logo=electron&logoColor=9FEAF9)
![HuggingFace](https://img.shields.io/badge/Hugging%20Face-Open%20Source-FFD21E?logo=huggingface&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-38d591)

<br>

</div>

---

## What is WorkspaceAlberta?

WorkspaceAlberta is a **Telegram-style chat app where every contact is an AI agent**. Each bot in your
sidebar has its own personality, model, and optional cloud computer. Talk to them like messaging
contacts, watch them work, approve what matters.

**Key differences from other AI chat apps:**

- **Open-source models first** — Powered by Hugging Face Inference Providers (Llama, Mistral, Qwen, etc.)
  with EU-pinnable endpoints. No vendor lock-in.
- **Linux-first** — Primary target is Raspberry Pi 5 16GB desk terminals and Linux workstations.
  macOS support included but secondary.
- **Local harness** — One small server on `127.0.0.1` runs all agent processes. Your transcripts,
  keys, and events stay in `~/.config/workspacealberta`, not a cloud.
- **Multiple bots** — Not one assistant, but a team: create bots for different roles, each with
  their own model and personality.

## Quick Start

### On Raspberry Pi / Ubuntu Desktop

**1. Download the `.deb` package:**

```sh
# For Raspberry Pi 5 (arm64)
wget https://github.com/HarleyCoops/openmausbot/releases/latest/download/workspacealberta_*_arm64.deb

# For x64 Linux
wget https://github.com/HarleyCoops/openmausbot/releases/latest/download/workspacealberta_*_amd64.deb
```

**2. Install:**

```sh
sudo dpkg -i workspacealberta_*.deb
sudo apt-get install -f  # Fix any missing dependencies
```

**3. Launch WorkspaceAlberta** from your applications menu.

**4. Configure Hugging Face:**

Open **App Settings** (gear icon in sidebar) and paste your [HF token](https://huggingface.co/settings/tokens).
That's it — your bots now run on open-source models.

### From Source

```sh
git clone https://github.com/HarleyCoops/openmausbot && cd openmausbot
pnpm install

pnpm dev:server    # harness server → 127.0.0.1:8799
pnpm dev           # app → http://127.0.0.1:5199
pnpm dev:desktop   # or the Electron shell
```

Requirements: **Node 20+**, **pnpm**

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

## Configuration

### Hugging Face (Default Provider)

WorkspaceAlberta uses Hugging Face Inference Providers as the default AI backend:

1. Get a token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Paste it in App Settings → "Hugging Face token"
3. Start chatting

**Custom endpoints:** For EU compliance or dedicated inference, set a custom base URL:
- App Settings → "Hugging Face base URL"
- Or `HF_BASE_URL` environment variable

### Optional: CLI Agents

Power users can also enable Claude Code and Codex CLIs:

| Provider | Install | Notes |
|----------|---------|-------|
| Claude Code | `npm i -g @anthropic-ai/claude-code` | Run `claude` once to sign in |
| Codex | `npm i -g @openai/codex` | OpenAI Codex CLI |

These appear automatically in the model picker when installed.

### Optional: Connected Apps

Paste credentials in **App Settings** to unlock additional features:

| Key | Unlocks |
|-----|---------|
| Composio Connect key (`ck_…`) | Gmail, Slack, GitHub, and 500+ app integrations |
| Box token | Cloud computers for your bots |

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

## Architecture

WorkspaceAlberta is two processes:

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron / Browser UI (React + Tailwind)                       │
│  - Chat interface, model picker, computer panel                 │
│  - Dispatches commands over HTTP                                │
│  - Folds one SSE event stream into state                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP + SSE
┌───────────────────────────▼─────────────────────────────────────┐
│  Harness Server (127.0.0.1:8799)                                │
│  - Driver registry: HF, Claude CLI, Codex CLI, Box              │
│  - Event bus normalizes all provider protocols                  │
│  - Permission broker for tool approvals                         │
│  - Transcript storage in ~/.config/workspacealberta             │
└─────────────────────────────────────────────────────────────────┘
```

### Adding a Provider

The driver SPI is intentionally small. Adding a provider:

1. Create `server/drivers/<name>.ts` (see `grok.ts` or `huggingface.ts` as examples)
2. Register in `server/drivers/builtIn.ts`
3. Add icon in `src/components/ProviderIcons.tsx`

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

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `HF_TOKEN` | Hugging Face API token | — |
| `HF_BASE_URL` | Custom HF inference endpoint | `https://router.huggingface.co/v1` |
| `WA_PORT` | Server port | `8799` |
| `WA_ANALYTICS` | Opt-in to telemetry (`1` to enable) | disabled |
| `BOX_TOKEN` | Box cloud computer token | — |
| `COMPOSIO_KEY` | Composio Connect key | — |

## License

MIT — see [LICENSE](LICENSE).

Based on [OpenMausBot](https://github.com/milind-soni/OpenMausBot) by Milind Soni.

## Contributing

Contributions welcome! The driver SPI in [`server/contracts.ts`](server/contracts.ts) is
deliberately small. See the existing drivers in [`server/drivers/`](server/drivers/) for examples.

---

<div align="center">

**WorkspaceAlberta** — AI bots for operators, powered by open-source models.

</div>
