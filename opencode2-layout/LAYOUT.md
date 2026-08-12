# Dual-Screen Layout Map

WorkspaceAlberta CEO terminal — Bloomberg-style dual-monitor layout for always-on procurement work.

```
+=============================================================================+
|  SCREEN 1 (LEFT) — Primary Work Display                                     |
|  Attach tmux window 1 here                                                  |
+=============================================================================+
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | PANE 1: procurement (Primary Agent)                          ~60%    |  |
|  | $ opencode2 ~/WorkspaceAlberta                                        |  |
|  |                                                                       |  |
|  | • CanadaBuys opportunity discovery                                    |  |
|  | • Bid/no-bid analysis                                                 |  |
|  | • MCP tool usage (buildcanada)                                        |  |
|  | • Procurement workflow execution                                      |  |
|  +-----------------------------------------------------------------------+  |
|  +-----------------------------------------------------------------------+  |
|  | PANE 2: health / log watch                                   ~40%    |  |
|  | $ watch -n 30 'opencode2 api get /api/health'                        |  |
|  | $ tail -f ~/.local/share/opencode/log/opencode.log                   |  |
|  |                                                                       |  |
|  | • Service health monitoring                                           |  |
|  | • Session activity logs                                               |  |
|  | • Error/warning tracking                                              |  |
|  +-----------------------------------------------------------------------+  |
+=============================================================================+

+=============================================================================+
|  SCREEN 2 (RIGHT) — Status / Reference Display                              |
|  Attach tmux window 2 here OR use separate terminal window                  |
+=============================================================================+
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  | PANE 3: browser / secondary session placeholder              ~50%    |  |
|  |                                                                       |  |
|  | OPERATOR: Place Chromium browser here for:                            |  |
|  | • CanadaBuys.canada.ca live portal                                    |  |
|  | • WorkspaceAlberta chat app                                           |  |
|  | • GitHub PRs / issues                                                 |  |
|  | • Documentation reference                                             |  |
|  |                                                                       |  |
|  | OR launch secondary opencode2 session:                                |  |
|  | $ opencode2 ~/workspaceAlbertaSetup                                   |  |
|  +-----------------------------------------------------------------------+  |
|  +-----------------------------------------------------------------------+  |
|  | PANE 4: service status / system monitoring                   ~50%    |  |
|  | $ watch -n 60 'opencode2 service status'                             |  |
|  |                                                                       |  |
|  | • opencode2 service status                                            |  |
|  | • System resource usage (htop)                                        |  |
|  | • Tailscale connectivity                                              |  |
|  | • Network health                                                      |  |
|  +-----------------------------------------------------------------------+  |
+=============================================================================+


MODEL ASSIGNMENT
================

PANE  ROLE                MODEL                        PURPOSE
----  ------------------  ---------------------------  ------------------------------
1     procurement         deepseek/deepseek-chat       Primary procurement work, MCP tools
2     (monitoring)        N/A                          Health/log display only
3     (browser/aux)       N/A or deepseek-chat         Browser or secondary session
4     (monitoring)        N/A                          Service status display only


PHYSICAL SETUP
==============

Option A: Two terminal windows on two monitors
----------------------------------------------
• Left monitor: Terminal 1 with `tmux attach -t wa-terminal` → select window 1
• Right monitor: Terminal 2 with `tmux attach -t wa-terminal` → select window 2

Option B: Single wide monitor split
-----------------------------------
• Use terminal split or tiling WM (i3, sway) to place two terminals side by side
• Each terminal attaches to same tmux session, different windows

Option C: tmux within single terminal
-------------------------------------
• Single terminal, use `Ctrl+A 1` and `Ctrl+A 2` to switch windows
• Less ideal for always-visible Bloomberg style

RECOMMENDED: Option A for true dual-monitor Bloomberg experience.


TMUX SESSION STRUCTURE
======================

Session: wa-terminal

Window 1: screen1-work
├── Pane 0.0: opencode2 ~/WorkspaceAlberta (procurement agent)
└── Pane 0.1: health/log watch

Window 2: screen2-status  
├── Pane 1.0: browser placeholder (notes until browser placed)
└── Pane 1.1: service status watch


KEYBINDS (after Ctrl+A prefix)
==============================

Key       Action
--------  ----------------------------------
1         Switch to window 1 (work)
2         Switch to window 2 (status)
h/j/k/l   Navigate panes (vim-style)
d         Detach session (keeps running)
r         Reload tmux config
C-n       New window
C-w       Kill window


ALWAYS-ON CHECKLIST
===================

□ opencode2 service running: `opencode2 service status`
□ tmux session exists: `tmux list-sessions | grep wa-terminal`
□ systemd units enabled: `systemctl --user is-enabled opencode2-wa wa-terminal-tmux`
□ Lingering enabled: `loginctl show-user $USER | grep Linger=yes`
□ API keys in environment: check `~/.bashrc` or systemd environment files
□ WorkspaceAlberta repo cloned: `ls ~/WorkspaceAlberta`
```
