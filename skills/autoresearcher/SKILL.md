---
name: autoresearcher
description: "Use when asked to mine DSH session traces for harness training. Feed traces into dsh-continual-evolve (/evolve plan, memories, prompt notes). Do not write SKILL.md playbooks."
---

# Autoresearcher

Go through session traces and train the harness. Not SKILL.md files.

## Sources

- Sessions: `~/.dsh/sessions/*/session-*/session.jsonl.zstd`
- Harness store: `~/.dsh/evolve/` via `/evolve` and `evolve_*` tools
- Keep only `user/message` where `data.source.kind == "user"`

## Pass

1. Sample user-source turns from the traces (`zstd -dc`, do not dump secrets).
2. Run `/evolve plan` (or `evolve_add` / `evolve_update`) so the harness gets prompt notes and memories grounded in those turns.
3. Prefer `memory` and `prompt` entries. Do not materialize new guidance skills under `~/.dsh/skills/learned/` unless the evolve gate asks Christian and he says yes.
4. Do not overwrite `j-space`.
5. Do not restart `:3080`, OpenCode2, Workspace Alberta Electron, or Firefox.
6. Do not upload traces. Do not start Adaption or any paid training run.

## Hard stops

- Do not delete session logs.
- Do not put secrets or `.credentials.yaml` into evolve entries.
