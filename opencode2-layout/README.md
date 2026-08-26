# OpenCode2 Always-On Layout for WorkspaceAlberta

Operator provisioning guide for the WorkspaceAlberta CEO terminal. Dual-monitor Bloomberg-style layout running `opencode2` (V2 managed service) on Raspberry Pi / Ubuntu Desktop.

**Priority:** Get it running and always-on. Branding is secondary.

---

## Prerequisites

- Ubuntu Desktop 24.04+ or Raspberry Pi OS (64-bit)
- `opencode2` installed (V2 CLI with managed background service)
- `tmux` >= 3.3
- WorkspaceAlberta repo cloned to `~/WorkspaceAlberta`
- Provider API keys configured via environment

### Install opencode2 (V2)

```bash
curl -fsSL https://opencode.ai/install | bash
```

Verify you have the V2 CLI with managed service support:

```bash
opencode2 --version
opencode2 service status
```

If you only have `opencode` (V1), upgrade to `opencode2` before proceeding.

---

## Quick Install

```bash
cd ~/workspaceAlbertaSetup/opencode2-layout
chmod +x scripts/install-layout.sh
./scripts/install-layout.sh
```

This copies configs, installs systemd user units, and enables lingering.

---

## Start the Terminal

```bash
./scripts/start-wa-terminal.sh
```

Or via systemd (after install):

```bash
systemctl --user start wa-terminal-tmux
```

Detach with `Ctrl+A d`. The session persists after terminal close.

---

## Layout Overview

See [LAYOUT.md](LAYOUT.md) for the full dual-screen pane map.

**Screen 1 (Left — Work):**
- Top (~60%): `opencode2` in `~/WorkspaceAlberta` — primary procurement agent
- Bottom (~40%): Status pane — `opencode2 api get /api/health` + log tail

**Screen 2 (Right — Status):**
- Top: Browser placeholder / secondary project (operator places Chromium here)
- Bottom: `opencode2 service status` and system monitoring

For true dual-monitor: attach tmux window 1 to left display, window 2 to right (or use two terminal windows).

---

## Always-On Architecture

1. **opencode2 service** runs the shared background server (survives TUI close)
2. **tmux session** (`wa-terminal`) holds the layout panes
3. **systemd user units** restart services on crash and boot
4. **loginctl enable-linger** keeps user services running when logged out

```
┌─────────────────────────────────────────────────────────────────┐
│  systemd --user                                                 │
│  ├── opencode2-wa.service  ← keeps opencode2 service up         │
│  └── wa-terminal-tmux.service  ← restores tmux session on login │
│                                                                 │
│  tmux session: wa-terminal                                      │
│  ├── window 1: screen1-work                                     │
│  │   ├── pane 1: opencode2 ~/WorkspaceAlberta (procurement)    │
│  │   └── pane 2: health/log watch                               │
│  └── window 2: screen2-status                                   │
│      ├── pane 1: browser placeholder                            │
│      └── pane 2: service status / monitoring                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

Set in `~/.bashrc` or `~/.config/environment.d/opencode2.conf`:

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | Primary model provider |
| `ZAI_API_KEY` | Optional | Z.AI / GLM |
| `HF_TOKEN` | Optional | Hugging Face models + MCP |
| `COHERE_API_KEY` | Optional | Cohere Command A+ |
| `GITHUB_TOKEN` | Optional | GitHub MCP access |

**Never commit secrets.** Use environment variables or 1Password CLI.

---

## Security Notes

- Server binds to `127.0.0.1` by default (localhost only)
- Remote access via Tailscale SSH — do not expose `0.0.0.0` without auth
- If you must bind to `0.0.0.0`, set `OPENCODE_PASSWORD` for basic auth

---

## Troubleshooting

### opencode2 command not found

```bash
# Check if opencode (V1) exists but not opencode2
command -v opencode
command -v opencode2

# If only opencode exists, upgrade:
curl -fsSL https://opencode.ai/install | bash
```

### Service stuck or unhealthy

```bash
opencode2 service status
opencode2 api get /api/health

# If unhealthy, restart:
opencode2 service restart

# If restart loops, kill and restart:
pkill -f 'opencode.*serve'
opencode2 service start
```

### tmux session lost

```bash
# Check if session exists
tmux list-sessions

# Reattach
tmux attach-session -t wa-terminal

# Or restart
./scripts/start-wa-terminal.sh
```

### systemd user units not starting

```bash
# Check unit status
systemctl --user status opencode2-wa
systemctl --user status wa-terminal-tmux

# Check if lingering is enabled
loginctl show-user $USER | grep Linger

# Enable if not
sudo loginctl enable-linger $USER
```

---

## Manual Installation

If you prefer manual setup over the install script:

```bash
# 1. Create config directories
mkdir -p ~/.config/opencode/{agents,themes}

# 2. Copy configs
cp config/opencode.jsonc ~/.config/opencode/opencode.json
cp agents/*.md ~/.config/opencode/agents/
cp themes/workspace-alberta.json ~/.config/opencode/themes/

# 3. Copy tmux config
mkdir -p ~/.tmux
cp tmux/wa-terminal.conf ~/.tmux/wa-terminal.conf

# 4. Install systemd units
mkdir -p ~/.config/systemd/user
cp systemd/*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable opencode2-wa wa-terminal-tmux

# 5. Enable lingering
sudo loginctl enable-linger $USER

# 6. Start
systemctl --user start opencode2-wa
./scripts/start-wa-terminal.sh
```

---

## Related Docs

- [LAYOUT.md](LAYOUT.md) — Dual-screen pane map
- [docs/pi-out-of-box-setup.md](../docs/pi-out-of-box-setup.md) — Pi hardware setup
- [docs/ceo-pi-setup.md](../docs/ceo-pi-setup.md) — CEO terminal installer reference
- [docs/tailscale-pi-remote-support.md](../docs/tailscale-pi-remote-support.md) — Remote support via Tailscale

---

## WorkspaceAlberta MCP

This layout expects `~/WorkspaceAlberta` to be cloned:

```bash
git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta
cd ~/WorkspaceAlberta
python3 -m pip install -r requirements.txt
```

The `buildcanada` MCP server (`mcp-servers/canadabuys/server.py`) provides CanadaBuys procurement tools.
