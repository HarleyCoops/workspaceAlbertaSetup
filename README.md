<div align="center">

# WorkspaceAlberta Setup

**Provisioning home for WorkspaceAlberta CEO productivity terminals**

The product is the [WorkspaceAlberta harness](https://github.com/HarleyCoops/workspacealberta-harness)
(`workspace-alberta` branch) — a self-learning, Canadian-model AI terminal for building and
delivering real work. This repo puts it on hardware: the Pi first-boot installer, the industry
skill pack, and the operating docs for the fleet.

![License](https://img.shields.io/badge/License-MIT-38d591)

</div>

---

## Start Here

| What | Where |
|------|-------|
| **Pi first-boot installer** | [`installer/install-ceo-pi.sh`](installer/install-ceo-pi.sh) |
| **Beginner's Pi guide** | [`docs/pi-out-of-box-setup.md`](docs/pi-out-of-box-setup.md) |
| **Installer reference** (harness setup, Cohere key, skill pack) | [`docs/ceo-pi-setup.md`](docs/ceo-pi-setup.md) |
| **Remote support runbook** | [`docs/tailscale-pi-remote-support.md`](docs/tailscale-pi-remote-support.md) |
| **Litter mobile support** | [`docs/litter-remote-support.md`](docs/litter-remote-support.md) |
| **Handheld companion** | [`docs/handheld-companion.md`](docs/handheld-companion.md) (full spec) · V2 experiment: [`firmware/companion/README.md`](firmware/companion/README.md) |

**Related:** the procurement MCP product (CanadaBuys agents, the E2B bid room, Hermes appliance)
lives in [`HarleyCoops/WorkspaceAlberta`](https://github.com/HarleyCoops/WorkspaceAlberta). The
product harness lives in [`HarleyCoops/workspacealberta-harness`](https://github.com/HarleyCoops/workspacealberta-harness).

---

## Two tracks, one repo

**Primary track — desk terminals.** The CEO productivity terminal: the DSH harness
([workspacealberta-harness](https://github.com/HarleyCoops/workspacealberta-harness), the
`workspace-alberta` branch) plus this setup repo. Desktop devices, Canadian model route,
industrial work through CanadaBuys.

**Experimental track — handheld companion.** [`firmware/companion`](firmware/companion) and
[`docs/handheld-companion.md`](docs/handheld-companion.md) are a separate, clearly-bounded
experiment in a handheld form factor. It does not ship with the desk terminal, is not part of
the procurement product, and is tracked here only so hardware work stays versioned. Do not read
it as a change in positioning: the product is the desk.

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
- **The WorkspaceAlberta skill pack** into `~/.dsh/skills/` (see below)
- **1Password** (optional) for credential management
- **WorkspaceAlberta Pro subscriber key** (prompted for, or pass `WA_API_KEY=wa_live_...`)

The subscriber key is what makes a terminal billable. The hosted procurement
endpoint gates bid rooms, Cohere tender review, the watchlist, and bid/no-bid
scorecards on an `Authorization: Bearer wa_live_...` header — without a key the
terminal reaches the free tier only. The installer verifies the key against the
server before writing it, so a bad key fails during staging rather than at the
customer's desk. Set or rotate it later with:

```sh
curl -fsSL https://raw.githubusercontent.com/HarleyCoops/WorkspaceAlberta/main/installer/configure-subscriber-key.sh \
  | WA_API_KEY=wa_live_... bash
```

Pass `CONFIGURE_WA_KEY=0` to skip the step entirely.

After the installer, follow **First-login steps** in
[`docs/ceo-pi-setup.md`](docs/ceo-pi-setup.md): add the Cohere key to the harness credential
layering, clone and launch the harness fork on port 3081, and run the smoke checks.

---

## The industry skill pack

[`skills/`](skills/) is the fleet's working knowledge, git-versioned and installed flat into
`~/.dsh/skills/` (the harness loader scans one level only — never nest skill directories). It
carries `autoresearcher`, `browser-use-web-automation`, `j-space`, and the skills the evolve
loop wrote from real sessions (`linear-board-ops`, `dated-finance-research`,
`primary-source-investigation`, `autonomous-overnight-build`).

The pipeline: a terminal's harness learns locally, a human curates the winners into `skills/`
here, and every new Pi — and every installer re-run — receives them. Pack-managed skills update
in place; a terminal's own learned skills are never deleted. Verify the pack any time:

```sh
node scripts/verify.mjs
```

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `COHERE_API_KEY` | Cohere Command A+ — the harness default model (prefer `~/.dsh/.credentials.yaml`; `.env` files are fallback layers — see `docs/ceo-pi-setup.md`) | — |
| `E2B_API_KEY` | e2b sandbox API key for bid-room processing (consumed by the `WorkspaceAlberta` repo) | — |

---

## System Requirements

- **Raspberry Pi 5** with 8GB or 16GB RAM (16GB recommended), Ubuntu Desktop 24.04 LTS (arm64)
  or Raspberry Pi OS (64-bit)
- Or **Linux desktop**: Ubuntu 22.04+, Debian 12+, x64 or arm64

---

## Historical note

This repository previously shipped an OpenMausBot-derived Electron chat app. It was removed
when the DSH harness fork became the product: one surface, one story. Based on
[OpenMausBot](https://github.com/milind-soni/OpenMausBot) by Milind Soni.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

**WorkspaceAlberta** — the terminal learns your business while it works.

</div>
