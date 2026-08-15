<div align="center">

# WorkspaceAlberta

**Setup + Linux/Pi chat app for CEO productivity terminals**

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

## Start Here

This repository is the **setup home** for WorkspaceAlberta CEO productivity terminals:

| What | Where |
|------|-------|
| **Pi first-boot installer** | [`installer/install-ceo-pi.sh`](installer/install-ceo-pi.sh) |
| **Beginner's Pi guide** | [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md) |
| **Installer reference** | [`docs/ceo-pi-setup.md`](docs/ceo-pi-setup.md) |
| **Remote support runbook** | [`docs/tailscale-pi-remote-support.md`](docs/tailscale-pi-remote-support.md) |
| **Litter mobile support** | [`docs/litter-remote-support.md`](docs/litter-remote-support.md) |
| **Handheld companion** | [`docs/handheld-companion.md`](docs/handheld-companion.md) |
| **Linux chat app source** | This repo (React + Electron) |

**Related:** The procurement MCP product (CanadaBuys agents, Hermes appliance) lives in [`HarleyCoops/WorkspaceAlberta`](https://github.com/HarleyCoops/WorkspaceAlberta).

---

## What is WorkspaceAlberta?

WorkspaceAlberta is a **Telegram-style chat app where every contact is an AI agent**. Each bot in your
sidebar has its own personality, model, and optional cloud computer. Talk to them like messaging
contacts, watch them work, approve what matters.

> **Naming note:** The *product* users interact with is called **WorkspaceAlberta**. This repository
> (`workspaceAlbertaSetup`) contains the setup, packaging, and build infrastructure for the app.

**Key differences from other AI chat apps:**

- **Open-source models first** — Powered by Hugging Face Inference Providers (GLM, Llama, Mistral, Qwen, etc.)
  with EU-pinnable endpoints. No vendor lock-in.
- **Linux-first** — Primary target is Raspberry Pi 5 16GB desk terminals and Linux workstations.
  macOS support included but secondary.
- **Local harness** — One small server on `127.0.0.1` runs all agent processes. Your transcripts,
  keys, and events stay in `~/.config/workspacealberta`, not a cloud.
- **Multiple bots** — Not one assistant, but a team: create bots for different roles, each with
  their own model and personality.

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
- **1Password** for secure credential management
- **Tailscale** for remote support
- **Codex CLI + ChatGPT Desktop** for AI-assisted work
- **OpenCode** for MCP agent workflows
- **WorkspaceAlberta chat app** (from releases, or build instructions)

---

## Quick Start: Install the Chat App

### On Raspberry Pi / Ubuntu Desktop

**1. Download the `.deb` package:**

```sh
# For Raspberry Pi 5 (arm64)
wget https://github.com/HarleyCoops/workspaceAlbertaSetup/releases/latest/download/workspacealberta_arm64.deb

# For x64 Linux
wget https://github.com/HarleyCoops/workspaceAlbertaSetup/releases/latest/download/workspacealberta_amd64.deb
```

**2. Install:**

```sh
sudo dpkg -i workspacealberta_*.deb
sudo apt-get install -f  # Fix any missing dependencies
```

**3. Launch WorkspaceAlberta** from your applications menu.

**4. Configure Hugging Face:**

Open **App Settings** (gear icon in sidebar) and paste your [HF token](https://huggingface.co/settings/tokens).
That's it — new bots default to **GLM 4.6** on Hugging Face. Paste a Composio Connect key (`ck_…`) in App Settings if you want Gmail / Drive / Slack / GitHub tools on that same default bot.

### From Source (Linux / Raspberry Pi)

No packaged `.deb` required. From a clone:

```sh
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup && cd workspaceAlbertaSetup
pnpm install
pnpm start
```

`pnpm start` launches the harness server, Vite (`127.0.0.1:5199`), and Electron together. It waits for Vite (and the server) before opening the window — a black Electron window usually means Vite is not up yet.

On Linux/Pi the start path sets `ELECTRON_DISABLE_SANDBOX=1` and passes `--no-sandbox` (chrome-sandbox SUID errors). It also sets `ELECTRON_DISABLE_GPU=1` as a GPU fallback; unset that env var if your desktop GPU works.

If **pnpm 11** blocks `electron` / `esbuild` postinstall scripts:

```sh
pnpm config set dangerouslyAllowAllBuilds true
pnpm install
```

Requirements: **Node 20+**, **pnpm**

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

## Configuration

### Hugging Face (Default Provider)

WorkspaceAlberta uses Hugging Face Inference Providers as the default AI backend:

1. Get a token from [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Paste it in App Settings → "Hugging Face token"
3. Start chatting — new bots default to **GLM 4.6** (`zai-org/GLM-4.6` on the HF router)

**Custom endpoints:** For EU compliance or dedicated inference, set a custom base URL:
- App Settings → "Hugging Face base URL"
- Or `HF_BASE_URL` environment variable

### Optional: DeepSeek

Paid fallback via the official DeepSeek API (`deepseek-v4-pro` / `deepseek-v4-flash`). Hugging Face stays the default. Paste a key in App Settings, or set `DEEPSEEK_API_KEY`.

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
| Composio Connect key (`ck_…`) | Gmail, Drive, Slack, GitHub, and 500+ app integrations (works on the default Hugging Face bot) |
| DeepSeek API key | Optional paid model fallback (`deepseek-v4-pro`) |
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
│  - Driver registry: HF (default + Composio tools), DeepSeek,    │
│    Claude CLI, Codex CLI                                        │
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

---

<div align="center">

**WorkspaceAlberta** — AI bots for operators, powered by open-source models.

</div>
