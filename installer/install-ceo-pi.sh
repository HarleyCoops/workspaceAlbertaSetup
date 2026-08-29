#!/usr/bin/env bash
set -euo pipefail

# workspaceAlbertaSetup CEO productivity terminal first-boot installer.
# Run on Raspberry Pi 5 16GB with Raspberry Pi OS / Ubuntu 24.04+.
#
# New to Raspberry Pi? See docs/pi-out-of-box-setup.md for the complete
# beginner's guide: hardware checklist, flashing the OS, and first boot
# before running this script.
#
# This installer sets up the hyperproductive CEO stack:
# - 1Password for secrets and password management (optional)
# - Tailscale for remote support
# - Node.js 22 (NodeSource) + build-essential for native npm modules
# - DeepSeek Harness CLI (@deepseek-ai/dsh) — published package, not a
#   from-source monorepo build
# - Codex CLI + ChatGPT desktop for AI-assisted work
# - Claude Code CLI (required, with Codex, for Composio tools)
# - OpenCode for MCP-first agent workflows
# - WorkspaceAlberta Linux chat app (from this repo's releases)
#
# Optionally references HarleyCoops/WorkspaceAlberta for procurement MCP agents.

# -----------------------------------------------------------------------------
# Configuration from environment (all optional with sensible defaults)
# -----------------------------------------------------------------------------
HOSTNAME_FQ="${HOSTNAME_FQ:-}"
SUPPORT_USER="${SUPPORT_USER:-support}"
TS_AUTHKEY="${TS_AUTHKEY:-}"
TS_TAGS="${TS_TAGS:-tag:wa-terminal,tag:wa-pi5}"
INSTALL_1PASSWORD="${INSTALL_1PASSWORD:-1}"
INSTALL_CODEX_DESKTOP="${INSTALL_CODEX_DESKTOP:-1}"
INSTALL_OPENCODE="${INSTALL_OPENCODE:-1}"
INSTALL_CODEX_CLI="${INSTALL_CODEX_CLI:-1}"
INSTALL_CLAUDE_CODE="${INSTALL_CLAUDE_CODE:-1}"
INSTALL_TAILSCALE="${INSTALL_TAILSCALE:-1}"
INSTALL_NODE="${INSTALL_NODE:-1}"
INSTALL_DSH="${INSTALL_DSH:-1}"
INSTALL_WA_CHAT_APP="${INSTALL_WA_CHAT_APP:-1}"
INSTALL_HERMES_APPLIANCE="${INSTALL_HERMES_APPLIANCE:-0}"
CONFIGURE_WA_KEY="${CONFIGURE_WA_KEY:-1}"
INSTALL_OPENCODE2_LAYOUT="${INSTALL_OPENCODE2_LAYOUT:-1}"
INSTALL_WA_SKILLS="${INSTALL_WA_SKILLS:-1}"
CLONE_REPO="${CLONE_REPO:-1}"
SKIP_APT_UPGRADE="${SKIP_APT_UPGRADE:-0}"

# Repo this script lives in (needed before the clone step for OpenCode2 layout).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33mWARN:\033[0m %s\n' "$*"; }
err() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; }

require_command() {
  command -v "$1" >/dev/null 2>&1
}

# DeepSeek Harness needs Node 22.19+ or 24+. Desktop terminals can pick up an
# older Node earlier on PATH — prefer /usr/bin/node after NodeSource.
node_meets_dsh() {
  local ver major minor
  ver="${1#v}"
  major="${ver%%.*}"
  minor="${ver#*.}"
  minor="${minor%%.*}"
  major="${major:-0}"
  minor="${minor:-0}"
  if [ "$major" -ge 24 ]; then
    return 0
  fi
  if [ "$major" -eq 22 ] && [ "$minor" -ge 19 ]; then
    return 0
  fi
  return 1
}

# Detect architecture for package downloads
detect_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    aarch64|arm64) echo "arm64" ;;
    x86_64|amd64) echo "amd64" ;;
    *) echo "unknown" ;;
  esac
}

# -----------------------------------------------------------------------------
# Root check — most operations need sudo
# -----------------------------------------------------------------------------
if [ "$(id -u)" -eq 0 ]; then
  err "Do not run this script as root. Run as a normal user with sudo access."
  exit 1
fi

log "workspaceAlbertaSetup CEO Terminal Installer"
log "Architecture: $(uname -m) / $(detect_arch)"

# -----------------------------------------------------------------------------
# APT: Update and upgrade system packages
# -----------------------------------------------------------------------------
log "Updating package lists"
sudo apt-get update

if [ "$SKIP_APT_UPGRADE" = "0" ]; then
  log "Running full system upgrade (set SKIP_APT_UPGRADE=1 to skip)"
  sudo apt-get full-upgrade -y
else
  log "Skipping full-upgrade (SKIP_APT_UPGRADE=1)"
fi

log "Installing baseline packages"
sudo apt-get install -y \
  curl \
  ca-certificates \
  tmux \
  vim \
  git \
  htop \
  jq \
  unattended-upgrades \
  build-essential \
  python3

log "Enabling unattended-upgrades"
sudo systemctl enable --now unattended-upgrades || warn "unattended-upgrades service may already be enabled"

# -----------------------------------------------------------------------------
# Hostname (optional)
# -----------------------------------------------------------------------------
if [ -n "$HOSTNAME_FQ" ]; then
  log "Setting hostname to: $HOSTNAME_FQ"
  sudo hostnamectl set-hostname "$HOSTNAME_FQ"
  hostnamectl
else
  log "No HOSTNAME_FQ set; keeping current hostname: $(hostname)"
fi

# -----------------------------------------------------------------------------
# Support user (for remote administration)
# -----------------------------------------------------------------------------
log "Checking support user: $SUPPORT_USER"
if id "$SUPPORT_USER" &>/dev/null; then
  log "Support user '$SUPPORT_USER' already exists"
else
  log "Creating support user: $SUPPORT_USER"
  sudo adduser --disabled-password --gecos "WorkspaceAlberta Support" "$SUPPORT_USER"
  sudo usermod -aG sudo "$SUPPORT_USER"
  log "Support user created and added to sudo group"
fi

# -----------------------------------------------------------------------------
# Tailscale
# -----------------------------------------------------------------------------
if [ "$INSTALL_TAILSCALE" = "1" ]; then
  log "Installing Tailscale"
  if require_command tailscale; then
    log "Tailscale already installed: $(tailscale --version | head -1)"
  else
    curl -fsSL https://tailscale.com/install.sh | sh
  fi

  sudo systemctl enable --now tailscaled || warn "tailscaled may already be running"

  if [ -n "$TS_AUTHKEY" ]; then
    log "Joining Tailscale with provided auth key"
    ts_args=(--authkey="$TS_AUTHKEY" --ssh)
    if [ -n "$HOSTNAME_FQ" ]; then
      ts_args+=(--hostname="$HOSTNAME_FQ")
    fi
    if [ -n "$TS_TAGS" ]; then
      ts_args+=(--advertise-tags="$TS_TAGS")
    fi
    sudo tailscale up "${ts_args[@]}"
    log "Tailscale connected"
  else
    warn "No TS_AUTHKEY provided. Tailscale installed but not joined."
    warn "To join interactively, run:"
    if [ -n "$HOSTNAME_FQ" ]; then
      warn "  sudo tailscale up --hostname=\"$HOSTNAME_FQ\" --advertise-tags=\"$TS_TAGS\" --ssh"
    else
      warn "  sudo tailscale up --advertise-tags=\"$TS_TAGS\" --ssh"
    fi
  fi
else
  log "Skipping Tailscale installation (INSTALL_TAILSCALE=0)"
fi

# -----------------------------------------------------------------------------
# Node.js 22 (NodeSource) — DeepSeek Harness and npm global CLIs
# Desktop terminals can pick up an older Node on PATH. Use /usr/bin/node.
# Do not upgrade npm to 12 as a required step.
# -----------------------------------------------------------------------------
if [ "$INSTALL_NODE" = "1" ]; then
  log "Checking Node.js (need 22.19+ or 24+ for DeepSeek Harness)"
  node_bin=""
  if [ -x /usr/bin/node ]; then
    node_bin="/usr/bin/node"
  elif require_command node; then
    node_bin="$(command -v node)"
  fi

  if [ -n "$node_bin" ] && node_meets_dsh "$("$node_bin" -v 2>/dev/null || echo v0)"; then
    log "Node already meets requirement: $("$node_bin" -v) ($node_bin)"
  else
    if [ -n "$node_bin" ]; then
      warn "Found Node $("$node_bin" -v 2>/dev/null || echo unknown) at $node_bin — installing NodeSource Node 22"
    else
      log "Installing Node.js 22 from NodeSource"
    fi
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi

  if [ -x /usr/bin/node ]; then
    log "Node: $(/usr/bin/node -v)  npm: $(/usr/bin/npm -v)"
    log "Prefer /usr/bin/node and /usr/bin/npm if a desktop terminal shows an older version"
  else
    warn "Node.js is not at /usr/bin/node after install"
  fi
else
  log "Skipping Node.js installation (INSTALL_NODE=0)"
fi

# -----------------------------------------------------------------------------
# DeepSeek Harness — official published CLI (@deepseek-ai/dsh)
# Not a from-source monorepo build (too heavy on the Pi).
# node-pty native build needs g++ from build-essential (installed above).
# -----------------------------------------------------------------------------
if [ "$INSTALL_DSH" = "1" ]; then
  log "Installing DeepSeek Harness (@deepseek-ai/dsh)"
  if require_command dsh || [ -x /usr/bin/dsh ]; then
    log "DeepSeek Harness already installed: $(command -v dsh 2>/dev/null || echo /usr/bin/dsh)"
  elif [ -x /usr/bin/npm ]; then
    sudo /usr/bin/npm i -g @deepseek-ai/dsh || warn "npm install of @deepseek-ai/dsh failed (need build-essential / g++)"
    if [ -x /usr/bin/dsh ]; then
      log "DeepSeek Harness installed at /usr/bin/dsh"
    fi
  else
    warn "npm not found at /usr/bin/npm; install Node 22 and run: sudo /usr/bin/npm i -g @deepseek-ai/dsh"
  fi
else
  log "Skipping DeepSeek Harness installation (INSTALL_DSH=0)"
fi

# -----------------------------------------------------------------------------
# 1Password (Desktop + CLI)
# Password manager layer for the CEO terminal — secrets, browser unlock, SSH agent
# -----------------------------------------------------------------------------
if [ "$INSTALL_1PASSWORD" = "1" ]; then
  log "Installing 1Password"

  arch_raw="$(uname -m)"
  onepassword_installed=false

  # --- 1Password Desktop (tarball install) ---
  # Check if already installed
  if require_command 1password || [ -d "/opt/1Password" ] && [ -x "/opt/1Password/1password" ]; then
    log "1Password desktop already installed"
    onepassword_installed=true
  else
    case "$arch_raw" in
      aarch64|arm64)
        op_tarball_url="https://downloads.1password.com/linux/tar/stable/aarch64/1password-latest.tar.gz"
        ;;
      x86_64)
        op_tarball_url="https://downloads.1password.com/linux/tar/stable/x86_64/1password-latest.tar.gz"
        ;;
      *)
        warn "Unknown architecture '$arch_raw'; skipping 1Password desktop install"
        op_tarball_url=""
        ;;
    esac

    if [ -n "$op_tarball_url" ]; then
      log "Downloading 1Password desktop for $arch_raw"
      op_tarball="/tmp/1password-latest.tar.gz"
      if curl -fsSL -o "$op_tarball" "$op_tarball_url"; then
        log "Extracting 1Password to /opt/1Password"
        sudo mkdir -p /opt/1Password
        sudo tar -xzf "$op_tarball" -C /opt/1Password --strip-components=1

        if [ -x "/opt/1Password/after-install.sh" ]; then
          log "Running 1Password after-install script"
          sudo /opt/1Password/after-install.sh || warn "1Password after-install.sh returned non-zero"
        fi

        rm -f "$op_tarball"
        onepassword_installed=true
        log "1Password desktop installed"
      else
        warn "Failed to download 1Password desktop; continuing without it"
      fi
    fi
  fi

  # --- 1Password CLI (op) ---
  if require_command op; then
    log "1Password CLI (op) already installed"
  else
    log "Installing 1Password CLI"

    # Add 1Password apt repository with GPG key
    # Works for both amd64 and arm64
    op_cli_installed=false

    # Install prerequisites for apt repo
    sudo apt-get install -y gpg || warn "Could not install gpg"

    # Add the 1Password GPG key
    if curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | \
       sudo gpg --dearmor -o /usr/share/keyrings/1password-archive-keyring.gpg 2>/dev/null; then

      # Determine apt arch string
      case "$arch_raw" in
        aarch64|arm64)
          apt_arch="arm64"
          ;;
        x86_64)
          apt_arch="amd64"
          ;;
        *)
          apt_arch=""
          ;;
      esac

      if [ -n "$apt_arch" ]; then
        # Add the apt repository
        echo "deb [arch=$apt_arch signed-by=/usr/share/keyrings/1password-archive-keyring.gpg] https://downloads.1password.com/linux/debian/$apt_arch stable main" | \
          sudo tee /etc/apt/sources.list.d/1password.list >/dev/null

        # Add debsig policy for package verification
        sudo mkdir -p /etc/debsig/policies/AC2D62742012EA22/
        curl -fsSL https://downloads.1password.com/linux/debian/debsig/1password.pol | \
          sudo tee /etc/debsig/policies/AC2D62742012EA22/1password.pol >/dev/null
        sudo mkdir -p /usr/share/debsig/keyrings/AC2D62742012EA22
        curl -fsSL https://downloads.1password.com/linux/keys/1password.asc | \
          sudo gpg --dearmor -o /usr/share/debsig/keyrings/AC2D62742012EA22/debsig.gpg 2>/dev/null

        # Update and install CLI
        sudo apt-get update
        if sudo apt-get install -y 1password-cli; then
          op_cli_installed=true
          log "1Password CLI installed via apt"
        else
          warn "apt install of 1password-cli failed"
        fi
      fi
    else
      warn "Could not add 1Password GPG key"
    fi

    if [ "$op_cli_installed" = "false" ]; then
      warn "1Password CLI installation failed — you can install it manually later"
      warn "See: https://developer.1password.com/docs/cli/get-started/"
    fi
  fi
else
  log "Skipping 1Password installation (INSTALL_1PASSWORD=0)"
fi

# -----------------------------------------------------------------------------
# Codex CLI
# -----------------------------------------------------------------------------
if [ "$INSTALL_CODEX_CLI" = "1" ]; then
  log "Installing Codex CLI"
  if require_command codex; then
    log "Codex CLI already installed"
  else
    if curl -fsSL https://chatgpt.com/codex/install.sh | sh; then
      log "Codex CLI installed via official script"
    else
      warn "Official Codex install script failed; trying npm fallback"
      if require_command npm; then
        npm install -g @openai/codex || warn "npm install of @openai/codex failed"
      else
        warn "npm not found; install Node.js and run: npm install -g @openai/codex"
      fi
    fi
  fi

  # Ensure ~/.local/bin is on PATH for this session
  if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
else
  log "Skipping Codex CLI installation (INSTALL_CODEX_CLI=0)"
fi

# -----------------------------------------------------------------------------
# Claude Code CLI — default engine for Composio tools (HF/Llama is text-only)
# -----------------------------------------------------------------------------
if [ "$INSTALL_CLAUDE_CODE" = "1" ]; then
  log "Installing Claude Code CLI"
  if require_command claude; then
    log "Claude Code already installed"
  elif [ -x /usr/bin/npm ]; then
    sudo /usr/bin/npm i -g @anthropic-ai/claude-code || warn "npm install of @anthropic-ai/claude-code failed"
  elif require_command npm; then
    npm install -g @anthropic-ai/claude-code || warn "npm install of @anthropic-ai/claude-code failed"
  else
    warn "npm not found; install Node.js and run: sudo /usr/bin/npm i -g @anthropic-ai/claude-code"
  fi
else
  log "Skipping Claude Code installation (INSTALL_CLAUDE_CODE=0)"
fi

# -----------------------------------------------------------------------------
# ChatGPT / Codex Desktop (Linux ARM64/AMD64)
# -----------------------------------------------------------------------------
if [ "$INSTALL_CODEX_DESKTOP" = "1" ]; then
  log "Installing ChatGPT / Codex Desktop"

  arch="$(detect_arch)"
  case "$arch" in
    arm64)
      deb_url="https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_arm64.deb"
      deb_file="/tmp/chatgpt_arm64.deb"
      ;;
    amd64)
      deb_url="https://persistent.oaistatic.com/codex-app-prod/linux/deb/latest/chatgpt_amd64.deb"
      deb_file="/tmp/chatgpt_amd64.deb"
      ;;
    *)
      warn "Unknown architecture '$arch'; skipping ChatGPT desktop install"
      deb_url=""
      ;;
  esac

  if [ -n "$deb_url" ]; then
    # Check if already installed
    if dpkg -l | grep -q "chatgpt"; then
      log "ChatGPT desktop package already installed"
    else
      log "Downloading ChatGPT desktop for $arch"
      curl -fsSL -o "$deb_file" "$deb_url"

      log "Installing ChatGPT desktop package"
      # Note: On Raspberry Pi OS Bookworm this may show warnings if OS is older than officially supported
      sudo apt-get install -y "$deb_file" || {
        warn "apt-get install failed; trying dpkg + apt-get -f install"
        sudo dpkg -i "$deb_file" || true
        sudo apt-get install -f -y
      }

      rm -f "$deb_file"
      log "ChatGPT desktop installed"
    fi
  fi
else
  log "Skipping ChatGPT / Codex desktop installation (INSTALL_CODEX_DESKTOP=0)"
fi

# -----------------------------------------------------------------------------
# OpenCode
# -----------------------------------------------------------------------------
if [ "$INSTALL_OPENCODE" = "1" ]; then
  log "Installing OpenCode"
  if require_command opencode; then
    log "OpenCode already installed"
  else
    curl -fsSL https://opencode.ai/install | bash || warn "OpenCode install script failed"
  fi

  # Ensure ~/.local/bin is on PATH
  if [ -d "$HOME/.local/bin" ]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
else
  log "Skipping OpenCode installation (INSTALL_OPENCODE=0)"
fi

# -----------------------------------------------------------------------------
# OpenCode2 Always-On Layout (optional)
# Dual-monitor Bloomberg-style terminal with managed service and systemd units.
# See opencode2-layout/README.md for details.
# -----------------------------------------------------------------------------
if [ "$INSTALL_OPENCODE2_LAYOUT" = "1" ]; then
  log "Installing OpenCode2 always-on layout"

  # Check if opencode2 is available
  if require_command opencode2; then
    log "opencode2 (V2) found"
  elif require_command opencode; then
    warn "opencode (V1) found but opencode2 (V2) recommended for managed service"
    warn "The layout will work but service commands may not be available"
  else
    warn "Neither opencode nor opencode2 found — layout may not work correctly"
  fi

  # Run the layout installer if repo is present
  LAYOUT_INSTALLER="$REPO_DIR/opencode2-layout/scripts/install-layout.sh"
  if [ -x "$LAYOUT_INSTALLER" ]; then
    log "Running OpenCode2 layout installer"
    bash "$LAYOUT_INSTALLER" || warn "OpenCode2 layout installation had errors"
  elif [ -f "$LAYOUT_INSTALLER" ]; then
    chmod +x "$LAYOUT_INSTALLER"
    log "Running OpenCode2 layout installer"
    bash "$LAYOUT_INSTALLER" || warn "OpenCode2 layout installation had errors"
  else
    warn "OpenCode2 layout installer not found at: $LAYOUT_INSTALLER"
    warn "Manual installation: see $REPO_DIR/opencode2-layout/README.md"
  fi
else
  log "Skipping OpenCode2 layout installation (INSTALL_OPENCODE2_LAYOUT=0)"
  log "Note: To install the always-on dual-display layout later, run:"
  log "  bash $REPO_DIR/opencode2-layout/scripts/install-layout.sh"
fi

# -----------------------------------------------------------------------------
# Clone workspaceAlbertaSetup repo
# -----------------------------------------------------------------------------
if [ "$CLONE_REPO" = "1" ]; then
  log "Checking workspaceAlbertaSetup repo"
  if [ -d "$REPO_DIR/.git" ]; then
    log "Repo already exists at $REPO_DIR"
    log "Pulling latest changes"
    git -C "$REPO_DIR" pull --ff-only || warn "Could not pull; may have local changes"
  else
    log "Cloning workspaceAlbertaSetup to $REPO_DIR"
    git clone https://github.com/HarleyCoops/workspaceAlbertaSetup.git "$REPO_DIR"
  fi
else
  log "Skipping repo clone (CLONE_REPO=0)"
fi

# -----------------------------------------------------------------------------
# WorkspaceAlberta skill pack → ~/.dsh/skills/
# The harness skill loader scans ONE level: ~/.dsh/skills/<name>/SKILL.md.
# Pack skills ship flat and update in place; locally learned skills are never
# deleted, so each terminal's own evolve output survives a re-run.
# -----------------------------------------------------------------------------
if [ "$INSTALL_WA_SKILLS" = "1" ]; then
  if [ -d "$REPO_DIR/skills" ]; then
    log "Installing WorkspaceAlberta skill pack"
    mkdir -p "$HOME/.dsh/skills"
    for skill_dir in "$REPO_DIR/skills"/*/; do
      skill_name="$(basename "$skill_dir")"
      rm -rf "$HOME/.dsh/skills/$skill_name"
      cp -r "$skill_dir" "$HOME/.dsh/skills/$skill_name"
      log "Skill installed: $skill_name"
    done
  else
    warn "Skill pack not found at $REPO_DIR/skills; skipping"
  fi
else
  log "Skipping skill pack installation (INSTALL_WA_SKILLS=0)"
fi

# -----------------------------------------------------------------------------
# WorkspaceAlberta Chat App (Linux .deb from this repo's releases)
# -----------------------------------------------------------------------------
if [ "$INSTALL_WA_CHAT_APP" = "1" ]; then
  log "Checking for WorkspaceAlberta chat app"

  arch="$(detect_arch)"
  wa_app_installed=false

  # Check if already installed
  if dpkg -l 2>/dev/null | grep -qi "workspacealberta"; then
    log "WorkspaceAlberta chat app already installed"
    wa_app_installed=true
  fi

  if [ "$wa_app_installed" = "false" ]; then
    case "$arch" in
      arm64)
        wa_deb_url="https://github.com/HarleyCoops/workspaceAlbertaSetup/releases/latest/download/workspacealberta_arm64.deb"
        wa_deb_file="/tmp/workspacealberta_arm64.deb"
        ;;
      amd64)
        wa_deb_url="https://github.com/HarleyCoops/workspaceAlbertaSetup/releases/latest/download/workspacealberta_amd64.deb"
        wa_deb_file="/tmp/workspacealberta_amd64.deb"
        ;;
      *)
        warn "Unknown architecture '$arch'; skipping WorkspaceAlberta chat app install"
        wa_deb_url=""
        ;;
    esac

    if [ -n "$wa_deb_url" ]; then
      log "Attempting to download WorkspaceAlberta chat app for $arch"
      if curl -fsSL -o "$wa_deb_file" "$wa_deb_url" 2>/dev/null; then
        log "Installing WorkspaceAlberta chat app"
        sudo apt-get install -y "$wa_deb_file" || {
          warn "apt-get install failed; trying dpkg + apt-get -f install"
          sudo dpkg -i "$wa_deb_file" || true
          sudo apt-get install -f -y
        }
        rm -f "$wa_deb_file"
        log "WorkspaceAlberta chat app installed"
      else
        warn "No release found for WorkspaceAlberta chat app (this is OK for fresh repos)"
        warn "To build locally: cd $REPO_DIR && pnpm install && pnpm package:pi"
        log "The chat app can be installed later from releases or built from source"
      fi
    fi
  fi
else
  log "Skipping WorkspaceAlberta chat app installation (INSTALL_WA_CHAT_APP=0)"
fi

# -----------------------------------------------------------------------------
# Hermes appliance layer (optional, off by default)
# Points to the separate HarleyCoops/WorkspaceAlberta repo for procurement MCP
# -----------------------------------------------------------------------------
if [ "$INSTALL_HERMES_APPLIANCE" = "1" ]; then
  log "Installing Hermes appliance layer"
  HERMES_REPO_DIR="$HOME/WorkspaceAlberta"

  if [ ! -d "$HERMES_REPO_DIR/.git" ]; then
    log "Cloning WorkspaceAlberta (Hermes/procurement MCP) repo"
    git clone https://github.com/HarleyCoops/WorkspaceAlberta.git "$HERMES_REPO_DIR"
  fi

  if [ -x "$HERMES_REPO_DIR/installer/install-workspace-alberta-pi.sh" ]; then
    cd "$HERMES_REPO_DIR"
    ./installer/install-workspace-alberta-pi.sh
  else
    warn "Hermes installer not found at: $HERMES_REPO_DIR/installer/install-workspace-alberta-pi.sh"
    warn "Check that the WorkspaceAlberta repo cloned correctly"
  fi
else
  log "Skipping Hermes appliance layer (INSTALL_HERMES_APPLIANCE=0)"
  log "Note: The Hermes/procurement installer remains available in a separate repo:"
  log "  https://github.com/HarleyCoops/WorkspaceAlberta"
fi

# -----------------------------------------------------------------------------
# WorkspaceAlberta subscriber key
# A leased terminal without a key reaches the free tier only: the hosted MCP
# endpoint gates bid rooms, Cohere tender review, the watchlist, and bid/no-bid
# scorecards on an `Authorization: Bearer wa_live_...` header. The canonical
# provisioning script lives in the WorkspaceAlberta repo; use the local clone
# when present, otherwise fetch it rather than duplicating it here.
# -----------------------------------------------------------------------------
WA_KEY_SCRIPT_URL="https://raw.githubusercontent.com/HarleyCoops/WorkspaceAlberta/main/installer/configure-subscriber-key.sh"

if [ "$CONFIGURE_WA_KEY" = "1" ] && { [ -n "${WA_API_KEY:-}" ] || [ -t 0 ]; }; then
  log "Configuring WorkspaceAlberta subscriber key"
  wa_key_script="$HOME/WorkspaceAlberta/installer/configure-subscriber-key.sh"
  if [ ! -f "$wa_key_script" ]; then
    wa_key_script="$(mktemp)"
    if ! curl -fsSL -o "$wa_key_script" "$WA_KEY_SCRIPT_URL"; then
      warn "Could not fetch the key provisioning script; skipping."
      rm -f "$wa_key_script"
      wa_key_script=""
    fi
  fi
  if [ -n "$wa_key_script" ]; then
    bash "$wa_key_script" || warn "Subscriber key not configured; re-run later."
  fi
else
  log "Skipping WorkspaceAlberta subscriber key setup"
  log "Run it later with:"
  log "  curl -fsSL $WA_KEY_SCRIPT_URL | WA_API_KEY=wa_live_... bash"
fi

# -----------------------------------------------------------------------------
# Summary and next steps
# -----------------------------------------------------------------------------
log "Installation complete"

echo ""
echo "============================================================"
echo " workspaceAlbertaSetup CEO Terminal — Setup Summary"
echo "============================================================"
echo ""

# Hostname
echo "Hostname:       $(hostname)"
echo ""

# Tailscale
if [ "$INSTALL_TAILSCALE" = "1" ]; then
  if require_command tailscale; then
    ts_status="$(tailscale status 2>&1 || echo 'not connected')"
    if echo "$ts_status" | grep -q "Tailscale is stopped"; then
      echo "Tailscale:      installed but stopped"
    elif echo "$ts_status" | grep -qi "logged out"; then
      echo "Tailscale:      installed but not logged in"
    else
      ts_ip="$(tailscale ip -4 2>/dev/null || echo 'N/A')"
      echo "Tailscale:      connected"
      echo "  Tailscale IP: $ts_ip"
    fi
  else
    echo "Tailscale:      not installed"
  fi
else
  echo "Tailscale:      skipped"
fi

# 1Password
if [ "$INSTALL_1PASSWORD" = "1" ]; then
  if require_command 1password || [ -x "/opt/1Password/1password" ]; then
    echo "1Password:      installed"
  else
    echo "1Password:      not installed"
  fi
  if require_command op; then
    op_ver="$(op --version 2>/dev/null || echo 'installed')"
    echo "1Password CLI:  $op_ver"
  else
    echo "1Password CLI:  not installed"
  fi
else
  echo "1Password:      skipped"
fi
echo ""

# Node.js
if [ "$INSTALL_NODE" = "1" ]; then
  if [ -x /usr/bin/node ]; then
    echo "Node.js:        $(/usr/bin/node -v) (/usr/bin/node)"
    echo "npm:            $(/usr/bin/npm -v) (/usr/bin/npm)"
  elif require_command node; then
    echo "Node.js:        $(node -v) ($(command -v node))"
  else
    echo "Node.js:        not installed"
  fi
else
  echo "Node.js:        skipped"
fi

# DeepSeek Harness
if [ "$INSTALL_DSH" = "1" ]; then
  if [ -x /usr/bin/dsh ] || require_command dsh; then
    echo "DeepSeek dsh:   $(command -v dsh 2>/dev/null || echo /usr/bin/dsh)"
  else
    echo "DeepSeek dsh:   not installed"
  fi
else
  echo "DeepSeek dsh:   skipped"
fi

# Codex CLI
if [ "$INSTALL_CODEX_CLI" = "1" ]; then
  if require_command codex; then
    codex_ver="$(codex --version 2>/dev/null || echo 'installed')"
    echo "Codex CLI:      $codex_ver"
  else
    echo "Codex CLI:      installed (may need new shell for PATH)"
  fi
else
  echo "Codex CLI:      skipped"
fi

# Claude Code
if [ "$INSTALL_CLAUDE_CODE" = "1" ]; then
  if require_command claude; then
    echo "Claude Code:    $(claude --version 2>/dev/null || echo installed)"
  else
    echo "Claude Code:    installed (may need new shell for PATH)"
  fi
else
  echo "Claude Code:    skipped"
fi

# ChatGPT Desktop
if [ "$INSTALL_CODEX_DESKTOP" = "1" ]; then
  if dpkg -l 2>/dev/null | grep -q "chatgpt"; then
    echo "ChatGPT Desktop: installed"
  else
    echo "ChatGPT Desktop: not installed (may not support this OS)"
  fi
else
  echo "ChatGPT Desktop: skipped"
fi

# OpenCode
if [ "$INSTALL_OPENCODE" = "1" ]; then
  if require_command opencode; then
    oc_ver="$(opencode --version 2>/dev/null || echo 'installed')"
    echo "OpenCode:       $oc_ver"
  else
    echo "OpenCode:       installed (may need new shell for PATH)"
  fi
else
  echo "OpenCode:       skipped"
fi

# OpenCode2 Layout
if [ "$INSTALL_OPENCODE2_LAYOUT" = "1" ]; then
  if [ -f "$HOME/.config/opencode/opencode.json" ]; then
    echo "OpenCode2 Layout: installed"
  else
    echo "OpenCode2 Layout: config not found (run install-layout.sh manually)"
  fi
else
  echo "OpenCode2 Layout: skipped"
fi

# WorkspaceAlberta Chat App
if [ "$INSTALL_WA_CHAT_APP" = "1" ]; then
  if dpkg -l 2>/dev/null | grep -qi "workspacealberta"; then
    echo "WA Chat App:    installed"
  else
    echo "WA Chat App:    not installed (build with pnpm package:pi)"
  fi
else
  echo "WA Chat App:    skipped"
fi

# Repo
if [ -d "$REPO_DIR/.git" ]; then
  echo "Repo:           $REPO_DIR"
else
  echo "Repo:           not cloned"
fi

echo ""
echo "============================================================"
echo " Next Steps"
echo "============================================================"
echo ""
echo "1. Open a new terminal or run: source ~/.bashrc"
echo ""

if [ "$INSTALL_1PASSWORD" = "1" ]; then
  echo "2. (Optional) Sign into 1Password:"
  echo "   - Launch '1Password' from the applications menu"
  echo "   - Sign in with your CEO / business account"
  echo "   - Enable browser integration if prompted"
  echo "   - Skip with INSTALL_1PASSWORD=0 on the next unbox if unused"
  echo ""
fi

if [ "$INSTALL_CODEX_DESKTOP" = "1" ]; then
  echo "3. Sign into ChatGPT Desktop:"
  echo "   - Launch 'ChatGPT' from the applications menu"
  echo "   - Sign in with your OpenAI account"
  echo ""
fi

if [ "$INSTALL_CODEX_CLI" = "1" ]; then
  echo "4. Authenticate Codex CLI:"
  echo "   codex"
  echo "   (Follow the browser sign-in flow)"
  echo ""
fi

if [ "$INSTALL_CLAUDE_CODE" = "1" ]; then
  echo "4b. Authenticate Claude Code (required for Composio tools):"
  echo "   claude"
  echo "   Hugging Face / Llama in WorkspaceAlberta is text-only."
  echo ""
fi

if [ "$INSTALL_DSH" = "1" ]; then
  echo "4c. Launch DeepSeek Harness (Ubuntu Terminal, not the Electron app):"
  echo "   dsh web"
  echo "   Then open http://127.0.0.1:3080 and paste a DeepSeek API key in Settings → Models."
  echo "   This is separate from WorkspaceAlberta's in-app DeepSeek driver."
  echo ""
fi

if [ "$INSTALL_OPENCODE" = "1" ]; then
  echo "5. Authenticate OpenCode:"
  echo "   opencode"
  echo "   (Follow the provider auth flow)"
  echo ""
fi

if [ "$INSTALL_TAILSCALE" = "1" ] && [ -z "$TS_AUTHKEY" ]; then
  echo "6. Complete Tailscale setup:"
  echo "   sudo tailscale up --advertise-tags=\"$TS_TAGS\" --ssh"
  echo "   (Then approve the device in Tailscale admin console)"
  echo ""
fi

echo "7. Verify the setup:"
echo "   tailscale status"
echo "   /usr/bin/node -v"
echo "   /usr/bin/dsh --help"
echo "   1password --version"
echo "   op --version"
echo "   codex --version"
echo "   claude --version"
echo "   opencode --version"
echo ""

if [ "$INSTALL_WA_CHAT_APP" = "1" ]; then
  echo "8. Launch WorkspaceAlberta chat app:"
  echo "   - Find 'WorkspaceAlberta' in your applications menu, or"
  echo "   - From this repo: cd $REPO_DIR && git pull && pnpm install && pnpm start"
  echo "   - Vite is http://127.0.0.1:5199; HF/Llama is text-only (Claude or Codex for Composio)"
  echo ""
fi

echo "9. (Optional) Install procurement MCP tools:"
echo "   git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta"
echo "   cd ~/WorkspaceAlberta"
echo "   python -m pip install -r requirements.txt"
echo "   python -m unittest tests.test_canadabuys_mcp_smoke"
echo ""
echo "10. WorkspaceAlberta Pro key (required for bid rooms, tender review,"
echo "    watchlist, and scorecards on a leased terminal):"
if [ -f "$HOME/.config/workspacealberta/credentials" ]; then
  echo "    Configured: ~/.config/workspacealberta/credentials"
  echo "    Rotate with: bash ~/WorkspaceAlberta/installer/configure-subscriber-key.sh"
else
  echo "    NOT configured — this terminal is on the free tier."
  echo "    curl -fsSL $WA_KEY_SCRIPT_URL | WA_API_KEY=wa_live_... bash"
fi
echo ""
echo "============================================================"
