#!/usr/bin/env bash
# ============================================================================
# WorkspaceAlberta OpenCode2 Layout Installer
# ============================================================================
# Copies configs, installs systemd user units, enables lingering.
# Run from: ~/workspaceAlbertaSetup/opencode2-layout/
# ============================================================================

set -euo pipefail

# ---- Config ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAYOUT_DIR="$(dirname "$SCRIPT_DIR")"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[wa-layout]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }

# ---- Preflight checks ----
preflight() {
    log "Running preflight checks..."

    # Check for opencode2 (V2)
    if command -v opencode2 &>/dev/null; then
        ok "opencode2 found: $(opencode2 --version 2>/dev/null || echo 'installed')"
    elif command -v opencode &>/dev/null; then
        warn "opencode (V1) found but not opencode2 (V2)"
        warn "The layout requires opencode2 with managed service support"
        warn "Upgrade: curl -fsSL https://opencode.ai/install | bash"
        warn "Continuing, but service commands may not work..."
    else
        err "Neither opencode nor opencode2 found"
        err "Install: curl -fsSL https://opencode.ai/install | bash"
        exit 1
    fi

    # Check for tmux
    if ! command -v tmux &>/dev/null; then
        err "tmux not found. Install: sudo apt install tmux"
        exit 1
    fi
    ok "tmux found: $(tmux -V)"

    # Check for WorkspaceAlberta repo
    if [[ -d "$HOME/WorkspaceAlberta" ]]; then
        ok "WorkspaceAlberta repo found at ~/WorkspaceAlberta"
    else
        warn "WorkspaceAlberta repo not found at ~/WorkspaceAlberta"
        warn "Clone it for MCP tools: git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta"
    fi

    # Check for systemd user support
    if systemctl --user status &>/dev/null; then
        ok "systemd user mode available"
    else
        warn "systemd user mode may not be available"
        warn "Systemd units will be installed but may not work"
    fi

    ok "Preflight complete"
}

# ---- Install configs ----
install_configs() {
    log "Installing opencode2 configs..."

    # Create directories
    mkdir -p ~/.config/opencode/{agents,themes}
    mkdir -p ~/.tmux

    # Copy opencode config
    if [[ -f "$LAYOUT_DIR/config/opencode.jsonc" ]]; then
        cp "$LAYOUT_DIR/config/opencode.jsonc" ~/.config/opencode/opencode.json
        ok "Installed opencode.json"
    fi

    # Copy TUI config
    if [[ -f "$LAYOUT_DIR/config/tui.jsonc" ]]; then
        cp "$LAYOUT_DIR/config/tui.jsonc" ~/.config/opencode/tui.json
        ok "Installed tui.json"
    fi

    # Copy agents
    if [[ -d "$LAYOUT_DIR/agents" ]]; then
        cp "$LAYOUT_DIR/agents/"*.md ~/.config/opencode/agents/
        ok "Installed agents"
    fi

    # Copy theme
    if [[ -d "$LAYOUT_DIR/themes" ]]; then
        cp "$LAYOUT_DIR/themes/"*.json ~/.config/opencode/themes/
        ok "Installed themes"
    fi

    # Copy tmux config
    if [[ -f "$LAYOUT_DIR/tmux/wa-terminal.conf" ]]; then
        cp "$LAYOUT_DIR/tmux/wa-terminal.conf" ~/.tmux/wa-terminal.conf
        ok "Installed tmux config"
    fi

    ok "Configs installed"
}

# ---- Install systemd units ----
install_systemd() {
    log "Installing systemd user units..."

    mkdir -p ~/.config/systemd/user

    # Copy service files
    if [[ -d "$LAYOUT_DIR/systemd" ]]; then
        cp "$LAYOUT_DIR/systemd/"*.service ~/.config/systemd/user/
        ok "Copied service files"
    fi

    # Reload systemd
    systemctl --user daemon-reload
    ok "Reloaded systemd user daemon"

    # Enable services
    systemctl --user enable opencode2-wa.service || warn "Could not enable opencode2-wa.service"
    systemctl --user enable wa-terminal-tmux.service || warn "Could not enable wa-terminal-tmux.service"
    ok "Enabled systemd units"
}

# ---- Enable lingering ----
enable_lingering() {
    log "Checking user lingering..."

    if loginctl show-user "$USER" 2>/dev/null | grep -q "Linger=yes"; then
        ok "User lingering already enabled"
    else
        log "Enabling user lingering (requires sudo)..."
        if sudo loginctl enable-linger "$USER"; then
            ok "User lingering enabled"
        else
            warn "Could not enable lingering. Services may stop when you log out."
            warn "Run manually: sudo loginctl enable-linger $USER"
        fi
    fi
}

# ---- Main ----
main() {
    echo -e "${BLUE}"
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║   WorkspaceAlberta OpenCode2 Layout      ║"
    echo "  ║           Installer                      ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo -e "${NC}"

    preflight
    install_configs
    install_systemd
    enable_lingering

    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Set API keys in ~/.bashrc:"
    echo "     export DEEPSEEK_API_KEY=\"sk-...\""
    echo "     export OPENAI_API_KEY=\"sk-...\" # optional"
    echo ""
    echo "  2. Clone WorkspaceAlberta if not done:"
    echo "     git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta"
    echo ""
    echo "  3. Start the terminal:"
    echo "     $SCRIPT_DIR/start-wa-terminal.sh"
    echo ""
    echo "  4. Or start via systemd:"
    echo "     systemctl --user start opencode2-wa"
    echo "     systemctl --user start wa-terminal-tmux"
    echo ""
}

main "$@"
