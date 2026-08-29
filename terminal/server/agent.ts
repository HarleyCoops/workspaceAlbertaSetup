import { McpHttpClient } from "./mcp.ts";
import type { TerminalStore } from "./store.ts";
import type { Approval, Connector, Teammate } from "./types.ts";

export async function handleUserTurn(store: TerminalStore, teammateId: string, text: string) {
  const tm = store.teammate(teammateId);
  if (!tm) throw new Error("unknown teammate");
  store.appendMessage(teammateId, { role: "user", kind: "text", text });

  const intent = classify(text);
  if (intent.type === "remember") {
    store.remember(teammateId, intent.note);
    store.appendMessage(teammateId, {
      role: "teammate",
      kind: "text",
      text: `Noted. I will remember: “${intent.note}”.`,
    });
    return;
  }

  if (intent.type === "list_mcp") {
    await listShowcase(store, tm);
    return;
  }

  if (intent.type === "list_computer") {
    const files = store.computer.list();
    store.appendMessage(teammateId, {
      role: "teammate",
      kind: "activity",
      activity: { label: "computer.list", ok: true },
      text: files.length ? files.map((f) => `• ${f}`).join("\n") : "(empty workspace)",
    });
    return;
  }

  if (intent.type === "mcp_call") {
    const connector = pickConnector(store, tm, intent.connectorId);
    if (!connector) {
      store.appendMessage(teammateId, {
        role: "teammate",
        kind: "text",
        text: "No MCP connector is attached to me. Open Connectors and attach the WorkspaceAlberta showcase URL first.",
      });
      return;
    }
    store.createApproval({
      teammateId,
      kind: "mcp_call",
      title: `Call ${intent.toolName}`,
      summary: `${tm.name} wants to call \`${intent.toolName}\` on ${connector.name}. External MCP calls wait for your approval.`,
      connectorId: connector.id,
      toolName: intent.toolName,
      toolArgs: intent.args,
    });
    store.appendMessage(teammateId, {
      role: "teammate",
      kind: "text",
      text: `I can run \`${intent.toolName}\` on the ${connector.name} connector. Approve the card to send it out.`,
    });
    return;
  }

  if (intent.type === "computer_exec") {
    if (!tm.computerEnabled) {
      store.appendMessage(teammateId, {
        role: "teammate",
        kind: "text",
        text: "This teammate does not have the local computer enabled.",
      });
      return;
    }
    store.createApproval({
      teammateId,
      kind: "computer_exec",
      title: "Run computer command",
      summary: `${tm.name} wants to run \`${intent.command}\` in the local harness workspace. Commands wait for your approval.`,
      command: intent.command,
    });
    store.appendMessage(teammateId, {
      role: "teammate",
      kind: "text",
      text: `Ready to run \`${intent.command}\` on the local computer. Approve to execute.`,
    });
    return;
  }

  store.appendMessage(teammateId, {
    role: "teammate",
    kind: "text",
    text: defaultReply(tm, store, text),
  });
}

export async function resolveApproval(
  store: TerminalStore,
  approvalId: string,
  decision: "allow" | "deny",
): Promise<Approval> {
  const approval = store.approval(approvalId);
  if (!approval) throw new Error("unknown approval");
  if (approval.status !== "pending") return approval;
  if (decision === "deny") {
    const updated = store.setApproval(approvalId, "denied", "Denied by subscriber.");
    store.appendMessage(approval.teammateId, {
      role: "system",
      kind: "activity",
      activity: { label: "approval denied", ok: false },
      text: `${approval.title} was denied.`,
    });
    return updated;
  }

  try {
    if (approval.kind === "mcp_call" && approval.connectorId && approval.toolName) {
      const connector = store.connector(approval.connectorId);
      if (!connector) throw new Error("connector missing");
      store.appendMessage(approval.teammateId, {
        role: "teammate",
        kind: "activity",
        activity: { label: `mcp:${approval.toolName}` },
        text: `Calling ${approval.toolName}…`,
      });
      const client = new McpHttpClient(connector.url);
      const body = await client.callTool(approval.toolName, approval.toolArgs ?? {});
      const clipped = body.length > 4000 ? `${body.slice(0, 4000)}\n…truncated` : body;
      store.setApproval(approvalId, "allowed", clipped);
      store.appendMessage(approval.teammateId, {
        role: "teammate",
        kind: "activity",
        activity: { label: `mcp:${approval.toolName}`, ok: true },
        text: clipped,
      });
      return store.approval(approvalId)!;
    }

    if (approval.kind === "computer_exec" && approval.command) {
      const { output, exit } = await store.computer.exec(approval.command);
      store.recordComputer(approval.command, output, exit);
      store.setApproval(approvalId, "allowed", output);
      store.appendMessage(approval.teammateId, {
        role: "teammate",
        kind: "activity",
        activity: { label: `computer:${approval.command}`, ok: exit === 0 },
        text: output,
      });
      return store.approval(approvalId)!;
    }

    if (approval.kind === "computer_write" && approval.path !== undefined && approval.contents !== undefined) {
      store.computer.write(approval.path, approval.contents);
      store.recordComputer(`write ${approval.path}`, "written", 0);
      store.setApproval(approvalId, "allowed", `wrote ${approval.path}`);
      store.appendMessage(approval.teammateId, {
        role: "teammate",
        kind: "activity",
        activity: { label: `computer.write ${approval.path}`, ok: true },
        text: `Wrote ${approval.path}`,
      });
      return store.approval(approvalId)!;
    }

    throw new Error("approval has no executable payload");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.setApproval(approvalId, "allowed", `error: ${message}`);
    store.appendMessage(approval.teammateId, {
      role: "teammate",
      kind: "activity",
      activity: { label: "action failed", ok: false },
      text: message,
    });
    return store.approval(approvalId)!;
  }
}

async function listShowcase(store: TerminalStore, tm: Teammate) {
  const connector = pickConnector(store, tm);
  if (!connector) {
    store.appendMessage(tm.id, {
      role: "teammate",
      kind: "text",
      text: "Nothing attached. Add the WorkspaceAlberta MCP URL in Connectors, then attach it to me.",
    });
    return;
  }
  store.appendMessage(tm.id, {
    role: "teammate",
    kind: "activity",
    activity: { label: `mcp:tools/list ${connector.name}` },
    text: `Listing tools on ${connector.url}…`,
  });
  const refreshed = await store.refreshConnector(connector.id);
  if (refreshed.status === "error") {
    store.appendMessage(tm.id, {
      role: "teammate",
      kind: "activity",
      activity: { label: "mcp:tools/list", ok: false },
      text: refreshed.lastError ?? "failed to list tools",
    });
    return;
  }
  const lines = refreshed.tools.map((t) => `• ${t.name} — ${t.description.slice(0, 140)}`);
  store.appendMessage(tm.id, {
    role: "teammate",
    kind: "activity",
    activity: { label: `mcp:tools/list ${connector.name}`, ok: true },
    text: lines.length
      ? `${connector.name} (${connector.kind === "showcase" ? "showcase connector" : "MCP"}) at ${connector.url}\n${lines.join("\n")}`
      : "Connector answered, but listed no tools.",
  });
}

function pickConnector(store: TerminalStore, tm: Teammate, connectorId?: string): Connector | undefined {
  if (connectorId) return store.connector(connectorId);
  const attached = tm.connectorIds.map((id) => store.connector(id)).filter(Boolean) as Connector[];
  return attached.find((c) => c.kind === "showcase") ?? attached[0] ?? store.connector("wa-showcase");
}

type Intent =
  | { type: "remember"; note: string }
  | { type: "list_mcp" }
  | { type: "list_computer" }
  | { type: "mcp_call"; toolName: string; args: Record<string, unknown>; connectorId?: string }
  | { type: "computer_exec"; command: string }
  | { type: "chat" };

function classify(raw: string): Intent {
  const text = raw.trim();
  const lower = text.toLowerCase();

  const remember = text.match(/^(?:remember|note)\s*[:\-]?\s+(.+)/i);
  if (remember) return { type: "remember", note: remember[1].trim() };

  if (
    /list (the )?(showcase )?mcp|list (showcase )?tools|attach (the )?showcase|what tools|show connectors|list connectors/i.test(
      lower,
    )
  ) {
    return { type: "list_mcp" };
  }

  if (/list (computer )?files|show (the )?computer|list workspace|^ls$|^pwd$/i.test(lower)) {
    return { type: "list_computer" };
  }

  const run = text.match(/^(?:run|exec)\s+(.+)/i);
  if (run) return { type: "computer_exec", command: run[1].trim() };
  if (/^echo\s+/.test(lower)) return { type: "computer_exec", command: text };

  if (/approval gate|show approval|need(s)? approval/i.test(lower)) {
    return { type: "computer_exec", command: "echo WorkspaceAlberta Terminal" };
  }

  if (/daily brief|morning brief/i.test(lower)) {
    return { type: "mcp_call", toolName: "daily_bid_brief", args: {} };
  }
  if (/deadline|closing soon/i.test(lower)) {
    return { type: "mcp_call", toolName: "list_deadlines", args: { days: 14 } };
  }
  if (/alberta/i.test(lower) && /search|find|opportunit/i.test(lower)) {
    return {
      type: "mcp_call",
      toolName: "search_alberta_opportunities",
      args: { query: text, limit: 5 },
    };
  }
  if (/search|find|opportunit|tender|contract/i.test(lower)) {
    return { type: "mcp_call", toolName: "search_opportunities", args: { query: text, limit: 5 } };
  }

  return { type: "chat" };
}

function defaultReply(tm: Teammate, store: TerminalStore, text: string): string {
  const connectors = tm.connectorIds
    .map((id) => store.connector(id)?.name)
    .filter(Boolean)
    .join(", ");
  const memory = tm.memory.slice(-3).map((m) => `• ${m}`).join("\n");
  return [
    `${tm.name} here — ${tm.brief}`,
    memory ? `Memory:\n${memory}` : "I do not have notes yet. Say “remember …” to add one.",
    connectors
      ? `Attached connectors: ${connectors}. Ask me to list the showcase MCP, or to search tenders (that needs approval).`
      : "No MCP attached. Add https://elbowsupknivesout.warreandvavasour.com/mcp in Connectors.",
    tm.computerEnabled
      ? "Computer is on. “list files” reads the workspace; “run echo hello” asks for approval."
      : "Computer is off for this role.",
    `You said: “${text.slice(0, 240)}”`,
  ].join("\n\n");
}
