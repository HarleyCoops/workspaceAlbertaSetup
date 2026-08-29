---
name: autonomous-overnight-build
description: "Use for an overnight or autonomous build task on a constrained machine (Raspberry Pi 5): investigate a tool or domain, produce a working artifact or the closest honest fallback, and end with a self-contained NOTES.md + REPORT.md. Seen across the forge3d/emerald-lake night runs and the Buhler-Aurigema simulation report."
---

# Autonomous overnight build and report

## Premise

The same overnight loop ran at least three times on this Pi: research a tool/domain, build
or simulate something real, fall back honestly when the expensive path is not available,
and finish with a self-contained report. The instruction always says "do the work, not only
write a plan," with hard constraints (work only on this Pi, do not commit to client repos,
do not email, do not spend money beyond configured APIs). Do not re-derive the loop.

## Steps that worked

1. **Survey the environment first.** `pwd`, `ls`, the DSH env vars, which API keys are
   actually present (redact values), the toolchain (`python3`/`pip`/`uv`/`ffmpeg`/`node`/
   `git`), and a network test. Decide what is even possible before planning.
2. **Research the target and write NOTES.md.** Search and read public docs, then write the
   actual pipeline (input → reconstruction → output), and what needs a GPU/API vs what can
   run on this Pi.
3. **Plan with todo_write, then check which configured APIs actually work.** The traces
   found only a DeepSeek key and no usable 3D/video API — so the expensive path was off the
   table from the start.
4. **Pivot to the honest CPU fallback when the real path is not usable.** Download a public
   asset (a Wikimedia still), generate a depth map, build a self-contained viewer/orbit
   renderer, and emit frames to `out/frames/`.
5. **Run slow installs and downloads as background jobs** and poll them with `job_output`
   (`wait: true` with a timeout). Keep a log file (`/tmp/*.log`) for long pip/model steps so
   you can tail progress.
6. **Write REPORT.md that documents the exact error of the failed path** and what was
   produced instead. Verify it exists and is self-contained (check line counts / file
   sizes) before declaring done.
7. **Confirm nothing is still running** at the end: empty background-job list, no lingering
   render/venv processes. Clean up stalled jobs and malformed (zero-byte) files.

## Failure modes seen in the traces

- **No usable API configured** → do not pretend the GPU/API path ran; say so, fall back, and
  document it in REPORT.md.
- **Pi image ships no `pip`** → use `uv` (`forge3d` installed via `uv` into `venv/`), or
  bootstrap `get-pip.py --break-system-packages --user`.
- **GPU/WebGPU path fails but is not a missing-Vulkan problem** → record the exact error in
  REPORT.md and fall back to a CPU render (depth map + three.js orbit).
- **Slow install/download stalls** → background job + `job_output` poll; kill and clean up
  stalled jobs so nothing is left running.
- **`ffmpeg` is absent on the Pi** → do not block on it; assemble the orbit GIF/MP4 from the
  rendered frames with PIL / matplotlib animation and note the substitution in REPORT.md.
- **Turn ended without the deliverable** → on resume, inspect every file already created and
  the prior tool results, run the scripts and capture real outputs, then write REPORT.md;
  do not stop until it exists and is self-contained.
