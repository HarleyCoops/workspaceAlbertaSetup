#!/usr/bin/env node
// Smoke path: create/open teammate, send a message, list showcase MCP, approval gate.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const home = mkdtempSync(join(tmpdir(), "wa-terminal-"));
const port = String(18_000 + Math.floor(Math.random() * 1000));
const base = `http://127.0.0.1:${port}`;

async function waitForHealth() {
  const start = Date.now();
  while (Date.now() - start < 20_000) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return res.json();
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("harness did not start");
}

async function json(path, init) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  assert.ok(res.ok, `${path} ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const child = spawn(process.execPath, ["--experimental-strip-types", "terminal/server/index.ts"], {
  cwd: root,
  env: { ...process.env, WA_TERMINAL_HOME: home, WA_TERMINAL_PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (c) => {
  output += c.toString();
});
child.stderr.on("data", (c) => {
  output += c.toString();
});

const finish = (code) => {
  if (child.exitCode === null && !child.killed) {
    try {
      child.kill("SIGTERM");
    } catch {
      /* gone */
    }
  }
  process.exit(code);
};

try {
  const health = await waitForHealth();
  assert.equal(health.product, "WorkspaceAlberta Terminal");
  assert.equal(health.sku, "subscriber-terminal");
  assert.equal(health.leftoverChat, false);

  const boot = await json("/api/state");
  assert.ok(boot.teammates.length >= 3, "seed teammates");
  const names = boot.teammates.map((t) => t.name);
  assert.ok(names.includes("Operator"));
  assert.ok(names.includes("Procurement"));
  assert.ok(names.includes("Builder"));
  const showcase = boot.connectors.find((c) => c.kind === "showcase");
  assert.ok(showcase, "showcase MCP connector");
  assert.match(showcase.url, /elbowsupknivesout\.warreandvavasour\.com\/mcp/);

  const created = await json("/api/teammates", {
    method: "POST",
    body: JSON.stringify({ name: "Smoke Desk", role: "operator" }),
  });
  const tm = created.teammate;
  assert.equal(tm.name, "Smoke Desk");

  await json(`/api/teammates/${tm.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "hello from the subscriber terminal" }),
  });

  const listed = await json(`/api/teammates/${tm.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "list the showcase MCP" }),
  });
  const toolMsg = (listed.messages[tm.id] ?? []).filter((m) => m.kind === "activity").at(-1);
  assert.ok(toolMsg?.text, "MCP list activity");
  assert.match(toolMsg.text, /search_opportunities|list_deadlines|daily_bid_brief/);

  const refreshed = await json(`/api/connectors/${showcase.id}/refresh`, { method: "POST" });
  assert.equal(refreshed.connector.status, "ready");
  assert.ok(refreshed.connector.tools.length >= 8, "showcase tools listed");

  const gated = await json(`/api/teammates/${tm.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: "show approval gate" }),
  });
  const pending = gated.approvals.find((a) => a.status === "pending");
  assert.ok(pending, "approval gate stub");
  assert.equal(pending.kind, "computer_exec");

  const allowed = await json(`/api/approvals/${pending.id}`, {
    method: "POST",
    body: JSON.stringify({ decision: "allow" }),
  });
  assert.equal(allowed.approval.status, "allowed");
  assert.match(allowed.state.computer.lastOutput ?? "", /WorkspaceAlberta Terminal/);

  console.log("terminal smoke ok");
  console.log(`  teammates: ${allowed.state.teammates.map((t) => t.name).join(", ")}`);
  console.log(`  showcase tools: ${refreshed.connector.tools.length}`);
  console.log(`  approval: ${allowed.approval.status} · ${allowed.approval.command}`);
  finish(0);
} catch (err) {
  console.error(err instanceof Error ? err.stack || err.message : err);
  if (output) console.error(output);
  finish(1);
}
