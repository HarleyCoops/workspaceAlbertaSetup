---
name: linear-board-ops
description: "Use when operating a Linear workspace through MCP tools: bootstrapping or fixing Linear auth, surveying and categorizing a backlog, bulk-clearing stale/duplicate tickets, and updating sprint-ticket status. Seen on the Warreandvavasour board and the Math-To-Manim sprint (WAR-1526..1535)."
---

# Linear board operations via MCP

## Premise

Working a Linear board through the DSH harness has a fixed shape: fix access first, survey
and categorize before mutating, dry-run, bulk-mutate in the background, then verify and
retry idempotently. The traces did this on the Warreandvavasour workspace (key `WAR`) and
read the Math-To-Manim sprint tickets from the same board. Reuse the loop.

## Steps that worked

1. **Fix access before doing anything else.** Find the Linear MCP client config
   (`~/.dsh/profiles/web/cordis.patch.yml` → `mcp-remote https://mcp.linear.app/mcp`),
   complete the OAuth handshake so a `tokens.json` with `read write` scope lands. If the
   native `mcp__linear__*` tools still are not surfaced in the session, restart the DSH
   harness with a detached script so the fresh boot re-registers the tools and picks up the
   cached token. Smoke-test with `get_workspace`.
2. **Work around a flaky MCP path with curl.** When the MCP client is not re-registering,
   drive the Linear MCP HTTP endpoint / API directly with a curl-based helper — curl works
   where urllib hangs on SSE/HTTP2 keep-alive.
3. **Survey and categorize before mutating.** List teams/workspace/issues, then bucket:
   empty placeholders (`jobid: plan:unknown`), true duplicates (keep the newest copy),
   stale dated tasks, and In-Progress items. Never clear anything you have not bucketed.
4. **Dry-run the count, then bulk-mutate in a background job.** The traces cleared 302
   tickets sequentially (~1.4s each) as a background script, then spot-checked that specific
   IDs (e.g. WAR-1462, WAR-1968) actually landed as Canceled.
5. **Pick the honest status.** `Canceled` for stale/obsolete tickets; `Done` (completed)
   only when the work actually finished; `Todo` (unstarted) to reopen tickets for an
   orchestrator to pick up. The traces reverted 10 "Done" tickets back to `Todo` when the
   user re-scoped them as "keep, let the orchestrator build."
6. **Retry idempotently.** When parallel updates time out (6 of 10), first check the actual
   state of each ID, then retry only the failed ones sequentially.

## Failure modes seen in the traces

- **OAuth handshake in progress but not finished** (mcp-remote listening, no token stored) →
  complete the callback or use the stored token directly.
- **Native MCP tools not surfaced after auth** → restart the harness so the fresh boot
  re-registers them; confirm via `tools/list`.
- **urllib hangs on SSE/HTTP2 keep-alive** → switch to a curl-based helper.
- **Parallel bulk updates time out and silently miss some IDs** → verify actual state before
  retrying, and retry the misses one at a time.
- **Wrong status choice** (marking stale tickets `Done` when they are really `Canceled`) →
  use `Canceled` for obsolete work, and be ready to revert `Done` → `Todo` when scope
  changes.
- **Restart leaves the old `dsh web` as `<defunct>`/zombie** → it hung on `SIGTERM` and was
  `SIGKILL`ed; a defunct PID is dead (waiting for its parent to reap it), not a still-running
  server — the fresh PID is the one serving `:3080`.
