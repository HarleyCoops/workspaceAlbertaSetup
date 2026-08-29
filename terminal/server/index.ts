// WorkspaceAlberta Terminal harness — subscriber SKU.
// Binds 127.0.0.1:8899. Does not touch leftover :8799 or official DSH :3080.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { handleUserTurn, resolveApproval } from "./agent.ts";
import { TerminalStore } from "./store.ts";

const PORT = Number(process.env.WA_TERMINAL_PORT || 8899);
const HOST = process.env.WA_TERMINAL_HOST || "127.0.0.1";

const store = new TerminalStore();
const sseClients = new Set<ServerResponse>();

function broadcast() {
  const frame = `data: ${JSON.stringify({ kind: "state", state: store.snapshot() })}\n\n`;
  for (const res of [...sseClients]) {
    try {
      res.write(frame);
    } catch {
      sseClients.delete(res);
    }
  }
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function parseJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") throw new Error("JSON object required");
  return parsed as Record<string, unknown>;
}

function notFound(res: ServerResponse) {
  json(res, 404, { error: "not found" });
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method || "GET";

  if (path === "/api/health") {
    json(res, 200, {
      ok: true,
      product: "WorkspaceAlberta Terminal",
      sku: "subscriber-terminal",
      leftoverChat: false,
      port: PORT,
    });
    return;
  }

  if (path === "/api/events") {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`data: ${JSON.stringify({ kind: "state", state: store.snapshot() })}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (path === "/api/state" && method === "GET") {
    json(res, 200, store.snapshot());
    return;
  }

  if (path === "/api/teammates" && method === "POST") {
    const body = await parseJson(req);
    const tm = store.createTeammate({
      name: String(body.name ?? ""),
      role: (body.role as "operator" | "procurement" | "builder" | "custom") || "custom",
      brief: body.brief ? String(body.brief) : undefined,
    });
    broadcast();
    json(res, 200, { teammate: tm, state: store.snapshot() });
    return;
  }

  const select = path.match(/^\/api\/teammates\/([^/]+)\/select$/);
  if (select && method === "POST") {
    store.select(decodeURIComponent(select[1]));
    broadcast();
    json(res, 200, store.snapshot());
    return;
  }

  const patchTm = path.match(/^\/api\/teammates\/([^/]+)$/);
  if (patchTm && method === "PATCH") {
    const body = await parseJson(req);
    const tm = store.updateTeammate(decodeURIComponent(patchTm[1]), {
      name: body.name !== undefined ? String(body.name) : undefined,
      brief: body.brief !== undefined ? String(body.brief) : undefined,
      role: body.role as TeammateRole | undefined,
      computerEnabled: typeof body.computerEnabled === "boolean" ? body.computerEnabled : undefined,
      connectorIds: Array.isArray(body.connectorIds) ? body.connectorIds.map(String) : undefined,
      memory: Array.isArray(body.memory) ? body.memory.map(String) : undefined,
    });
    broadcast();
    json(res, 200, { teammate: tm, state: store.snapshot() });
    return;
  }

  const memory = path.match(/^\/api\/teammates\/([^/]+)\/memory$/);
  if (memory && method === "POST") {
    const body = await parseJson(req);
    const tm = store.remember(decodeURIComponent(memory[1]), String(body.text ?? body.note ?? ""));
    broadcast();
    json(res, 200, { teammate: tm, state: store.snapshot() });
    return;
  }

  const messages = path.match(/^\/api\/teammates\/([^/]+)\/messages$/);
  if (messages && method === "POST") {
    const body = await parseJson(req);
    const text = String(body.text ?? "").trim();
    if (!text) throw new Error("text is required");
    await handleUserTurn(store, decodeURIComponent(messages[1]), text);
    broadcast();
    json(res, 200, store.snapshot());
    return;
  }

  if (path === "/api/connectors" && method === "POST") {
    const body = await parseJson(req);
    const connector = store.addConnector({
      name: String(body.name ?? "MCP connector"),
      url: String(body.url ?? ""),
    });
    if (body.teammateId) {
      store.attachConnector(String(body.teammateId), connector.id, true);
    }
    broadcast();
    json(res, 200, { connector, state: store.snapshot() });
    return;
  }

  const attach = path.match(/^\/api\/connectors\/([^/]+)\/attach$/);
  if (attach && method === "POST") {
    const body = await parseJson(req);
    const tm = store.attachConnector(
      String(body.teammateId ?? store.selected().id),
      decodeURIComponent(attach[1]),
      body.attached !== false,
    );
    broadcast();
    json(res, 200, { teammate: tm, state: store.snapshot() });
    return;
  }

  const refresh = path.match(/^\/api\/connectors\/([^/]+)\/refresh$/);
  if (refresh && method === "POST") {
    const connector = await store.refreshConnector(decodeURIComponent(refresh[1]));
    broadcast();
    json(res, 200, { connector, state: store.snapshot() });
    return;
  }

  if (path === "/api/computer" && method === "GET") {
    json(res, 200, store.snapshot().computer);
    return;
  }

  if (path === "/api/computer/exec" && method === "POST") {
    const body = await parseJson(req);
    const command = String(body.command ?? "").trim();
    if (!command) throw new Error("command is required");
    const approval = store.createApproval({
      teammateId: String(body.teammateId ?? store.selected().id),
      kind: "computer_exec",
      title: "Run computer command",
      summary: `Run \`${command}\` in the local harness workspace.`,
      command,
    });
    broadcast();
    json(res, 200, { approval, state: store.snapshot() });
    return;
  }

  const decide = path.match(/^\/api\/approvals\/([^/]+)$/);
  if (decide && method === "POST") {
    const body = await parseJson(req);
    const decision = String(body.decision ?? "") === "deny" ? "deny" : "allow";
    const approval = await resolveApproval(store, decodeURIComponent(decide[1]), decision);
    broadcast();
    json(res, 200, { approval, state: store.snapshot() });
    return;
  }

  notFound(res);
}

type TeammateRole = "operator" | "procurement" | "builder" | "custom";

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /unknown|required|empty|must be/.test(message) ? 400 : 500;
    if (!res.headersSent) json(res, status, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[terminal] WorkspaceAlberta Terminal harness → http://${HOST}:${PORT}`);
  console.log(`[terminal] subscriber SKU — leftover OpenMausBot chat is not this product`);
});
