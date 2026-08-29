# CEO Productivity Terminal Setup

> **New to Raspberry Pi?** Start with [pi-out-of-box-setup.md](pi-out-of-box-setup.md) for the complete beginner's guide — hardware checklist, flashing the OS, and first boot. This document covers the software installer only.

This runbook covers first-boot setup for WorkspaceAlberta CEO productivity terminals built on Raspberry Pi 5 16GB.

The CEO stack focuses on hyperproductive AI-assisted workflows:

- **Tailscale** for secure remote support
- **Node.js 22** (NodeSource) plus `build-essential` / `python3` for native npm modules
- **DeepSeek Harness** (`@deepseek-ai/dsh`) — official published CLI, not a from-source monorepo build
- **Codex CLI** and **Claude Code** for AI pair programming and Composio tools
- **ChatGPT / Codex Desktop** (Linux arm64 `.deb`) for conversational AI on the desktop
- **OpenCode / OpenCode2** for MCP-first agent workflows
- **WorkspaceAlberta chat app** — the Telegram-style AI bot interface from this repo (`pnpm start` if no release `.deb`)
- **1Password** (optional) for credential and secrets management

This installer is separate from the Hermes appliance stack. Use the Hermes installer (in the separate `HarleyCoops/WorkspaceAlberta` repo) if you need the branded dashboard, procurement MCP agents, and local gateway services.

---

## Prerequisites

- Raspberry Pi 5 16GB, official 27W USB-C wall supply (or Ubuntu 24.04+ VM for testing)
- Fresh Raspberry Pi OS Bookworm or Ubuntu 24.04/26.04 ARM64
- Hostname example: `wa-pi5-christian-01`
- Internet connection
- A non-root user with sudo access
- Optional: Tailscale auth key from the admin console

---

## Quick start

Clone the repo and run the installer:

```bash
git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git ~/workspaceAlbertaSetup
cd ~/workspaceAlbertaSetup
chmod +x installer/install-ceo-pi.sh
./installer/install-ceo-pi.sh
```

For automated provisioning with Tailscale:

```bash
export HOSTNAME_FQ="wa-pi5-acme-edmonton-01"
export TS_AUTHKEY="tskey-auth-..."
./installer/install-ceo-pi.sh
```

---

## Environment variables

All configuration is through environment variables. All are optional with sensible defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `HOSTNAME_FQ` | (none) | Fully qualified hostname for the device |
| `SUPPORT_USER` | `support` | Remote support user account |
| `TS_AUTHKEY` | (none) | Tailscale auth key for unattended join |
| `TS_TAGS` | `tag:wa-terminal,tag:wa-pi5` | Tailscale device tags |
| `INSTALL_1PASSWORD` | `1` | Install 1Password desktop + CLI (optional product; set `0` to skip) |
| `INSTALL_CODEX_DESKTOP` | `1` | Install ChatGPT / Codex desktop app (Linux arm64/amd64 `.deb`) |
| `INSTALL_OPENCODE` | `1` | Install OpenCode CLI |
| `INSTALL_CODEX_CLI` | `1` | Install Codex CLI |
| `INSTALL_CLAUDE_CODE` | `1` | Install Claude Code CLI (`@anthropic-ai/claude-code`) |
| `INSTALL_TAILSCALE` | `1` | Install and configure Tailscale |
| `INSTALL_NODE` | `1` | Install Node.js 22 from NodeSource (`/usr/bin/node`) |
| `INSTALL_DSH` | `1` | Install DeepSeek Harness (`@deepseek-ai/dsh`) |
| `INSTALL_WA_CHAT_APP` | `1` | Install WorkspaceAlberta chat app from releases |
| `INSTALL_HERMES_APPLIANCE` | `0` | Also run the Hermes appliance installer (from separate repo) |
| `INSTALL_OPENCODE2_LAYOUT` | `1` | Install OpenCode2 always-on dual-display layout |
| `CLONE_REPO` | `1` | Pull or clone this repo (defaults to the tree that contains the installer) |
| `SKIP_APT_UPGRADE` | `0` | Skip apt full-upgrade for faster re-runs |

---

## What it installs

### Baseline packages

```text
curl ca-certificates tmux vim git htop jq unattended-upgrades
build-essential python3
```

`build-essential` (provides `g++`) and `python3` must be present before any native npm build. DeepSeek Harness's `node-pty` addon fails without them.

Unattended-upgrades is enabled to keep security patches current.

### Node.js 22 (NodeSource)

Installs Node 22 via the NodeSource `setup_22.x` script when `/usr/bin/node` is missing or older than **22.19** (Node 24+ also satisfies DeepSeek Harness).

Desktop terminals can pick up an older Node earlier on `PATH`. Use `/usr/bin/node` and `/usr/bin/npm`. Do not treat an npm 12 upgrade as a required step.

Skip with `INSTALL_NODE=0`.

### DeepSeek Harness

Installs the official published CLI, not a from-source monorepo checkout (too heavy on the Pi):

```bash
sudo /usr/bin/npm i -g @deepseek-ai/dsh
```

The binary lands at `/usr/bin/dsh`. Launch with `dsh web` from the Ubuntu Terminal app (not from inside the WorkspaceAlberta Electron window). Cwd does not matter. The UI binds `http://127.0.0.1:3080` only. Paste a DeepSeek API key in **Settings → Models**. That key is separate from WorkspaceAlberta's in-app DeepSeek driver.

Skip with `INSTALL_DSH=0`.

### Support user

Creates the support user (default: `support`) if missing and adds to the sudo group. This matches the remote support model in `tailscale-pi-remote-support.md`.

### 1Password

Installs the 1Password desktop app and CLI (`op`) for the CEO terminal's password/secrets layer.

**Desktop app:** Downloaded as a tarball from 1Password's official CDN and extracted to `/opt/1Password`:

- ARM64: `https://downloads.1password.com/linux/tar/stable/aarch64/1password-latest.tar.gz`
- x86_64: `https://downloads.1password.com/linux/tar/stable/x86_64/1password-latest.tar.gz`

After extraction, runs `/opt/1Password/after-install.sh` to complete setup.

**CLI (`op`):** Installed via apt from 1Password's official Debian repository with GPG verification. Supports both arm64 and amd64.

Skip with `INSTALL_1PASSWORD=0`.

### Tailscale

Installs via the official script:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

If `TS_AUTHKEY` is set, joins the tailnet automatically with Tailscale SSH enabled:

```bash
sudo tailscale up --authkey="$TS_AUTHKEY" --hostname="$HOSTNAME_FQ" --advertise-tags="$TS_TAGS" --ssh
```

If no auth key is provided, Tailscale is installed but not joined. Run the join command interactively after install.

### Codex CLI

Installs via the official script:

```bash
curl -fsSL https://chatgpt.com/codex/install.sh | sh
```

Falls back to npm if the shell script fails:

```bash
npm install -g @openai/codex
```

### Claude Code CLI

Installs the default Composio tool engine:

```bash
sudo /usr/bin/npm i -g @anthropic-ai/claude-code
```

Hugging Face / Llama in WorkspaceAlberta is text-only. Claude or Codex is required for Gmail / Drive / Slack / GitHub.

Skip with `INSTALL_CLAUDE_CODE=0`.

### ChatGPT / Codex Desktop

Downloads and installs the official Linux desktop app:

- ARM64: `chatgpt_arm64.deb`
- AMD64: `chatgpt_amd64.deb`

The desktop app is officially validated on Ubuntu 24.04/26.04, Debian 13, and Fedora. On Raspberry Pi OS Bookworm it may install but show warnings if the OS is older than officially supported.

Skip with `INSTALL_CODEX_DESKTOP=0`.

### OpenCode

Installs via the official script:

```bash
curl -fsSL https://opencode.ai/install | bash
```

Skip with `INSTALL_OPENCODE=0`.

### workspaceAlbertaSetup repo

Clones to `~/workspaceAlbertaSetup` if not already present. If the repo exists, pulls the latest changes.

Skip with `CLONE_REPO=0`.

### WorkspaceAlberta chat app

Attempts to download and install the Linux `.deb` from this repo's GitHub releases:

- ARM64: `workspacealberta_arm64.deb`
- AMD64: `workspacealberta_amd64.deb`

If no release exists yet, the installer gracefully skips this step. Run the app from this repo:

```bash
cd ~/workspaceAlbertaSetup
git pull
pnpm install
pnpm start
```

`pnpm start` launches `scripts/start-desktop.mjs` (harness on `127.0.0.1:8799`, Vite on `127.0.0.1:5199`, then Electron). `pnpm package:pi` is optional if you want a `.deb`.

Skip with `INSTALL_WA_CHAT_APP=0`.

### OpenCode2 always-on layout

Installs a dual-monitor Bloomberg-style layout for always-on OpenCode2 operation:

- Copies configs to `~/.config/opencode/`
- Installs tmux layout to `~/.tmux/wa-terminal.conf`
- Installs systemd user units for automatic restart
- Enables user lingering for service persistence

The layout uses `opencode2` (V2 CLI with managed background service). See `opencode2-layout/README.md` for details.

Skip with `INSTALL_OPENCODE2_LAYOUT=0`.

### WorkspaceAlberta agent harness (dsh)

The self-hosted agent harness (`WorkspaceAlberta-Harness`, the branded dsh fork) is cloned to
`~/Projects/WorkspaceAlberta-Harness` and serves its web UI on `127.0.0.1:3081`. Launch it with:

```bash
cd ~/Projects/WorkspaceAlberta-Harness
DSH_TELEMETRY_DISABLED=1 pnpm dsh --profile web --patch workspace-alberta.patch.yml \
  --host 127.0.0.1 --port 3081 --no-open
```

**Model provider — Cohere Command A+.** The deployment patch pins the default agent model to
Cohere (`command-a-plus-05-2026` via `api.cohere.ai/compatibility/v1`), so every Pi needs a
`COHERE_API_KEY` before the harness can answer. The harness resolves the key through its
credential layering, in this order:

1. `~/.dsh/.credentials.yaml` — managed store (preferred; `KEY: value` lines, `0600` perms)
2. `<launch directory>/.env` — the harness repo's `.env` (`COHERE_API_KEY=...`)
3. `~/.dsh/.env` — home-level fallback

Store the key in all three on a new Pi (the store is authoritative; the `.env` copies make it
survive regardless of launch directory), then (re)start the harness — credentials are read at
provider startup, not live.

**Harness-side configuration notes** (these live in the harness repo, so pull latest before
debugging on a new Pi):

- The `workspace-alberta.patch.yml` deployment overlay disables the DeepSeek adapter, web
  search, and telemetry, and inserts the `workspace_alberta` MCP server. Composio MCP comes from
  the `web` profile's own `cordis.patch.yml` — do not add `mcp-composio` to both files (duplicate
  loader entry ids crash boot).
- The `tool-web` row is disabled in all three agent presets (`cordis`, `standard`, `code`)
  because the host `web` service is disabled; otherwise every session fails preset mount with
  `tool-web waiting for web` and no model call ever runs.
- The web profile lives at `~/.dsh/profiles/web/` (`cordis.patch.yml` there holds the Linear and
  Composio MCP clients).

### Hermes appliance (optional)

Set `INSTALL_HERMES_APPLIANCE=1` to also clone and run the Hermes installer from the separate `HarleyCoops/WorkspaceAlberta` repository. This adds the branded dashboard, procurement MCP agents, local API gateway, and kiosk autostart.

By default this is off (`0`) because:
- The CEO stack focuses on direct AI tool access
- The WorkspaceAlberta chat app provides the primary UI from this repo
- Procurement MCP tools can be installed separately if needed

---

## First-login steps

After the installer completes, open a new terminal and complete these steps:

### 1. Sign into 1Password (optional)

Launch 1Password from the applications menu and sign in with your CEO / business account. Enable browser integration if prompted for autofill in Chromium/Firefox. Skip if you are not using 1Password.

### 2. Sign into ChatGPT Desktop

Launch ChatGPT from the applications menu and sign in with your OpenAI account.

### 3. Authenticate Codex CLI

```bash
codex
```

Follow the browser sign-in flow to authenticate.

### 3b. Authenticate Claude Code

```bash
claude
```

Required (or Codex) for Composio tools. HF/Llama is text-only.

### 3c. Launch DeepSeek Harness

```bash
dsh web
```

Open `http://127.0.0.1:3080` on the Pi and paste a DeepSeek API key in Settings → Models. Separate from the in-app DeepSeek driver.

### 4. Authenticate OpenCode

```bash
opencode
```

Follow the provider authentication flow.

### 4a. Start OpenCode2 terminal layout (if installed)

```bash
~/workspaceAlbertaSetup/opencode2-layout/scripts/start-wa-terminal.sh
```

This starts the dual-monitor Bloomberg-style layout with `opencode2`. Detach with `Ctrl+A d`.

Or start via systemd:

```bash
systemctl --user start opencode2-wa
systemctl --user start wa-terminal-tmux
```

### 5. Configure WorkspaceAlberta Chat App

If a `.deb` was installed, launch WorkspaceAlberta from the applications menu. Otherwise from this repo:

```bash
cd ~/workspaceAlbertaSetup
git pull
pnpm install
pnpm start
```

Vite listens on `127.0.0.1:5199`. Hugging Face / Llama is optional **text-only** inference. Claude or Codex is required for Composio tools.

- Open **App Settings** (gear icon in sidebar)
- Paste your [Hugging Face token](https://huggingface.co/settings/tokens) only if you want HF text inference
- Paste a Composio Connect key (`ck_…`) after Claude or Codex is signed in

### 5a. Add the Cohere key for the agent harness

Add your Cohere API key (`COHERE_API_KEY`) to the harness credential locations — see
[WorkspaceAlberta agent harness (dsh)](#workspacealberta-agent-harness-dsh) above for the
layering and commands. Without it the harness UI works but every message fails silently.

### 6. Complete Tailscale setup (if no auth key was provided)

```bash
sudo tailscale up --ssh --hostname="$(hostname)" --advertise-tags="tag:wa-terminal,tag:wa-pi5"
```

Then approve the device in the Tailscale admin console.

`tailscale ssh user@<hostname>` works from a Windows desktop on the same tailnet. For unattended commands, add a dedicated ed25519 key — see [Dedicated OpenSSH key from Windows](tailscale-pi-remote-support.md#dedicated-openssh-key-from-windows) in the remote support runbook.

---

## Smoke checks

Verify the installation:

```bash
# System
hostname
hostnamectl

# Tailscale
tailscale status
tailscale ip -4

# 1Password
1password --version
op --version

# Node + DeepSeek Harness
/usr/bin/node -v
/usr/bin/npm -v
/usr/bin/dsh --help

# AI tools
codex --version
claude --version
opencode --version
opencode2 --version
dpkg -l | grep chatgpt

# OpenCode2 layout (if installed)
ls ~/.config/opencode/opencode.json
tmux list-sessions | grep wa-terminal
systemctl --user is-enabled opencode2-wa wa-terminal-tmux

# WorkspaceAlberta chat app
dpkg -l | grep workspacealberta

# WorkspaceAlberta agent harness (dsh, if installed)
grep -q '^COHERE_API_KEY:' ~/.dsh/.credentials.yaml && echo "cohere key present"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3081/   # expect 200 when running
```

---

## Remote support

Once Tailscale is connected, support staff can reach the device:

```bash
tailscale ssh support@wa-pi5-acme-edmonton-01
tmux attach -t support || tmux new -s support
```

See `tailscale-pi-remote-support.md` for the full remote support runbook.

---

## Re-running the installer

The installer is idempotent for most operations:

- Skips packages that are already installed
- Skips Tailscale join if already connected
- Pulls latest repo changes instead of re-cloning

For faster re-runs during testing:

```bash
SKIP_APT_UPGRADE=1 ./installer/install-ceo-pi.sh
```

---

## Secrets

Do not commit secrets to the repository.

The installer never bakes auth keys into the image. `TS_AUTHKEY` is read from the environment at runtime and not stored anywhere.

For provisioning batches, use short-lived reusable Tailscale auth keys and revoke them after the batch is complete.

---

## Related docs

- [pi-out-of-box-setup.md](pi-out-of-box-setup.md) — Complete beginner's guide
- [tailscale-pi-remote-support.md](tailscale-pi-remote-support.md) — Tailscale remote support runbook
- [opencode2-layout/README.md](../opencode2-layout/README.md) — OpenCode2 always-on layout guide
- [opencode2-layout/LAYOUT.md](../opencode2-layout/LAYOUT.md) — Dual-screen pane map

### In separate repo (HarleyCoops/WorkspaceAlberta)

- Hermes appliance setup
- Procurement MCP agents (CanadaBuys, etc.)
- Terminal hardware spec
