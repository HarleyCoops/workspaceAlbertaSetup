#!/usr/bin/env bash
# ============================================================================
# WorkspaceAlberta OpenCode2 Terminal Stop Script
# ============================================================================
# Gracefully stops the tmux session and optionally the opencode2 service.
#
# Usage: bash scripts/stop-wa-terminal.sh [--service]
#   --service   Also stop the opencode2 managed service
# ============================================================================

set -euo pipefail

# ---- Config ----
TMUX_SESSION="wa-terminal"

# ---- Colors ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[wa-terminal]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}[ OK ]${NC} $*"; }

# ---- Stop tmux session ----
stop_tmux() {
    log "Stopping tmux session: $TMUX_SESSION"

    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
        tmux kill-session -t "$TMUX_SESSION"
        ok "tmux session '$TMUX_SESSION' stopped"
    else
        warn "tmux session '$TMUX_SESSION' not running"
    fi
}

# ---- Stop opencode2 service ----
stop_service() {
    log "Stopping opencode2 service..."

    if command -v opencode2 &>/dev/null; then
        if opencode2 service status 2>/dev/null | grep -qi "running"; then
            opencode2 service stop
            ok "opencode2 service stopped"
        else
            warn "opencode2 service not running"
        fi
    else
        warn "opencode2 not found — cannot stop service"
    fi
}

# ---- Main ----
main() {
    local stop_service_flag=false

    for arg in "$@"; do
        case "$arg" in
            --service)
                stop_service_flag=true
                ;;
            *)
                err "Unknown argument: $arg"
                echo "Usage: $0 [--service]"
                exit 1
                ;;
        esac
    done

    stop_tmux

    if [[ "$stop_service_flag" == "true" ]]; then
        stop_service
    else
        log "Note: opencode2 service still running (use --service to stop it)"
    fi

    ok "Done"
}

main "$@"
