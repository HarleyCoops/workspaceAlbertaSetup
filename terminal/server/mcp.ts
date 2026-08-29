// Streamable HTTP MCP client. One mesh: connectors are MCP servers.
// Showcase default is the hosted WorkspaceAlberta procurement endpoint.

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpClientInfo {
  protocolVersion?: string;
  serverName?: string;
  serverVersion?: string;
}

function parseMcpBody(text: string): unknown {
  const line = text.startsWith("{")
    ? text
    : text.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
  if (!line) throw new Error("empty MCP response");
  const msg = JSON.parse(line) as { error?: { message?: string }; result?: unknown };
  if (msg.error) throw new Error(msg.error.message || "MCP error");
  return msg.result ?? null;
}

export class McpHttpClient {
  private nextId = 1;
  private sessionId: string | null = null;
  private initialized = false;

  constructor(
    readonly url: string,
    readonly clientName = "workspacealberta-terminal",
  ) {}

  private async rpc(method: string, params: Record<string, unknown> = {}, timeoutMs = 20_000) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    };
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId;
    const res = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: this.nextId++, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const sid = res.headers.get("mcp-session-id");
    if (sid) this.sessionId = sid;
    if (!res.ok) throw new Error(`MCP HTTP ${res.status} from ${this.url}`);
    return parseMcpBody(await res.text());
  }

  async initialize(): Promise<McpClientInfo> {
    const result = (await this.rpc("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: this.clientName, version: "0.1.0" },
    })) as {
      protocolVersion?: string;
      serverInfo?: { name?: string; version?: string };
    };
    try {
      await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      /* some hosts ignore the notification */
    }
    this.initialized = true;
    return {
      protocolVersion: result?.protocolVersion,
      serverName: result?.serverInfo?.name,
      serverVersion: result?.serverInfo?.version,
    };
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.initialized) await this.initialize();
    const result = (await this.rpc("tools/list", {})) as {
      tools?: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }>;
    };
    return (result?.tools ?? [])
      .filter((t): t is { name: string; description?: string; inputSchema?: Record<string, unknown> } =>
        Boolean(t && typeof t.name === "string"),
      )
      .map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema,
      }));
  }

  async callTool(name: string, args: Record<string, unknown> = {}, timeoutMs = 45_000): Promise<string> {
    if (!this.initialized) await this.initialize();
    const result = (await this.rpc("tools/call", { name, arguments: args }, timeoutMs)) as {
      content?: Array<{ type?: string; text?: string }>;
      isError?: boolean;
    };
    const texts = (result?.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text as string);
    const body = texts.join("\n") || JSON.stringify(result ?? {}, null, 2);
    if (result?.isError) throw new Error(body);
    return body;
  }
}
