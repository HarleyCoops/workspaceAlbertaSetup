# J-Space Learned Skills

Use the playbooks Autoresearcher already mined from this Pi's DSH traces. Do not re-derive
a loop that is sitting in `~/.dsh/skills/learned/`. Improve those files when a live run
beats them.

## Where they live

- Directory: `~/.dsh/skills/learned/<slug>/SKILL.md`
- Writer: Autoresearcher (`~/.dsh/skills/autoresearcher/`) creates new ones from repeated traces
- This module: load, follow, and tighten them

Current set (re-list the directory; do not assume this table is complete):

- `autonomous-overnight-build`
- `primary-source-investigation`
- `dated-finance-research`
- `linear-board-ops`

## Use

This is a **loop** or **full** pass. J-space still owns the workspace. The learned skill
owns the operational steps.

1. List `~/.dsh/skills/learned/*/SKILL.md` and pick the one whose `description` matches.
2. Read that `SKILL.md` before you invent a plan.
3. Follow its steps. Do not skip the survey / dry-run / verify bits it already recorded.
4. If two learned skills match, load the tighter one and keep the other as a check.

If none match, do the work with the rest of this suite. Do not invent a new learned skill
here — that is Autoresearcher's job after a pattern has happened twice.

## Improve

At the last seam of a matching run, edit the learned `SKILL.md` in place when any of these
is true:

- a step in the file failed, and you found the step that actually worked
- a failure mode showed up that is not in the file
- a step is dead (never used, contradicted by the traces)
- a constraint Christian already stated is missing (do not restart `:3080`, do not invent
  numbers, do not spend money, do not ask him to paste commands)

Rules for the edit:

- Evidence only. One better step or one new failure mode is enough. Do not pad.
- Keep YAML `name` and `description`. Tighten `description` only if the when-to-use line is wrong.
- Do not overwrite `j-space` or `autoresearcher`.
- Do not move a learned skill out of `~/.dsh/skills/learned/`.
- Do not restart `:3080`, OpenCode2, Workspace Alberta Electron, or Firefox.

If nothing in the run beat the file, leave it. A quiet pass is not a rewrite.

## Hard stops

- Do not upload traces. Do not start a training run.
- Do not put secrets or `.credentials.yaml` into a skill.
- Do not delete session logs.
