#!/usr/bin/env bash
# ============================================================================
# WorkspaceAlberta OpenCode2 Terminal Launcher
# ============================================================================
# Boots opencode2 service + tmux layout for dual-monitor Bloomberg-style desk.
# Always-on friendly: survives terminal close, detach with Ctrl+A d.
#
# Usage: bash scripts/start-wa-terminal.sh [--attach]
#   --attach   Re-attach to existing session instead of creating new
# ============================================================================

set -euo pipefail

# ---- Config ----
TMUX_SESSION="wa-terminal"
TMUX_CONF="${HOME}/.tmux/wa-terminal.conf"
LOG_FILE="/tmp/wa-terminal.log"
WA_PROJECT_DIR="${HOME}/WorkspaceAlberta"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[wa-terminal]${NC} $*" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*" | tee -a "$LOG_FILE"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*" | tee -a "$LOG_FILE"; }

# ---- Preflight ----
preflight() {
    log "Running preflight checks..."

    # Check for opencode2 (prefer V2) or opencode (V1 fallback)
    if command -v opencode2 &>/dev/null; then
        OPENCODE_CMD="opencode2"
        ok "opencode2 (V2) found"
    elif command -v opencode &>/dev/null; then
        OPENCODE_CMD="opencode"
        warn "opencode (V1) found — opencode2 (V2) is recommended for managed service"
        warn "Upgrade: curl -fsSL https://opencode.ai/install | bash"
    else
        err "Neither opencode nor opencode2 found"
        err "Install: curl -fsSL https://opencode.ai/install | bash"
        exit 1
    fi

    # Check tmux
    if ! command -v tmux &>/dev/null; then
        err "tmux not found. Install: sudo apt install tmux"
        exit 1
    fi
    ok "tmux found"

    # Check tmux config
    if [[ ! -f "$TMUX_CONF" ]]; then
        warn "tmux config not at $TMUX_CONF"
        warn "Run install-layout.sh first, or copy manually"
    fi

    # Check WorkspaceAlberta directory
    if [[ -d "$WA_PROJECT_DIR" ]]; then
        ok "WorkspaceAlberta found at $WA_PROJECT_DIR"
    else
        warn "WorkspaceAlberta not found at $WA_PROJECT_DIR"
        warn "Clone: git clone https://github.com/HarleyCoops/WorkspaceAlberta.git ~/WorkspaceAlberta"
        warn "Pane will start in HOME instead"
    fi

    # Check API keys (warn, don't fail)
    [[ -z "${DEEPSEEK_API_KEY:-}" ]] && warn "DEEPSEEK_API_KEY not set — DeepSeek model calls may fail"
    [[ -z "${ZAI_API_KEY:-}" && -z "${HF_TOKEN:-}" && -z "${COHERE_API_KEY:-}" ]] && warn "No ZAI_API_KEY, HF_TOKEN, or COHERE_API_KEY — only DeepSeek is available"

    ok "Preflight complete"
}

# ---- Start opencode2 service ----
start_service() {
    log "Starting opencode2 managed service..."

    if [[ "$OPENCODE_CMD" == "opencode2" ]]; then
        # Check if service is already running
        if $OPENCODE_CMD service status 2>/dev/null | grep -qi "running"; then
            ok "opencode2 service already running"
        else
            log "Starting opencode2 service..."
            $OPENCODE_CMD service start &>/dev/null || true
            sleep 2
        fi

        # Health check
        if $OPENCODE_CMD api get /api/health &>/dev/null; then
            ok "opencode2 service healthy"
        else
            warn "opencode2 service may not be healthy — check logs"
        fi
    else
        log "Using opencode V1 — service management not available"
        log "TUI will start its own server instance"
    fi
}

# ---- Launch tmux ----
launch() {
    local attach_mode="${1:-false}"

    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        if [[ "$attach_mode" == "true" ]]; then
            log "Attaching to existing session: $TMUX_SESSION"
            exec tmux attach-session -t "$TMUX_SESSION"
        else
            warn "Session '$TMUX_SESSION' already exists."
            warn "Use --attach to re-attach, or kill it first with: tmux kill-session -t $TMUX_SESSION"
            exit 1
        fi
    fi

    log "Launching WorkspaceAlberta terminal layout..."
    log "  Session: $TMUX_SESSION"
    log "  Config:  $TMUX_CONF"
    log "  Log:     $LOG_FILE"
    log ""

    # Boot tmux with our config
    if [[ -f "$TMUX_CONF" ]]; then
        exec tmux -f "$TMUX_CONF" new-session -A -s "$TMUX_SESSION"
    else
        # Fallback: create minimal layout inline
        local start_dir="$WA_PROJECT_DIR"
        [[ ! -d "$start_dir" ]] && start_dir="$HOME"

        exec tmux new-session -A -s "$TMUX_SESSION" \
            \; rename-window "screen1-work" \
            \; send-keys "cd '$start_dir' && $OPENCODE_CMD" Enter \
            \; split-window -v -p 40 \
            \; send-keys "watch -n 30 '$OPENCODE_CMD service status 2>/dev/null || echo Service not available'" Enter \
            \; new-window -n "screen2-status" \
            \; send-keys "echo 'Browser placeholder — place Chromium here or launch secondary session'" Enter \
            \; split-window -v -p 50 \
            \; send-keys "htop" Enter \
            \; select-window -t 1 \
            \; select-pane -t 0
    fi
}

# ---- Main ----
main() {
    echo -e "${BLUE}"
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║   WorkspaceAlberta CEO Terminal          ║"
    echo "  ║         OpenCode2 Always-On              ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo -e "${NC}"

    preflight
    start_service

    local mode="new"
    if [[ "${1:-}" == "--attach" ]]; then
        mode="attach"
    fi

    launch "$([[ "$mode" == "attach" ]] && echo true || echo false)"
}

main "$@"
