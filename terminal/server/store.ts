import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LocalComputer } from "./computer.ts";
import { McpHttpClient } from "./mcp.ts";
import {
  SHOWCASE_MCP_ID,
  SHOWCASE_MCP_URL,
  type Approval,
  type Connector,
  type Message,
  type Teammate,
  type TerminalState,
} from "./types.ts";

function dataRoot(): string {
  if (process.env.WA_TERMINAL_HOME) return process.env.WA_TERMINAL_HOME;
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "workspacealberta", "terminal");
  return join(homedir(), ".config", "workspacealberta", "terminal");
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedTeammates(): Teammate[] {
  const now = Date.now();
  return [
    {
      id: "tm-operator",
      name: "Operator",
      role: "operator",
      brief:
        "Desk lead for this subscriber terminal. Coordinates teammates, the local computer, and MCP connectors.",
      memory: [
        "Every subscriber gets this same WorkspaceAlberta Terminal.",
        "Warre & Vavasour (Christian Cooper) turns business plans into products, systems, or tools.",
      ],
      connectorIds: [SHOWCASE_MCP_ID],
      computerEnabled: true,
      createdAt: now,
    },
    {
      id: "tm-procurement",
      name: "Procurement",
      role: "procurement",
      brief:
        "Canadian procurement teammate. Uses the WorkspaceAlberta MCP as a showcase connector — CanadaBuys and Alberta tenders — not as the product SKU.",
      memory: [
        "Showcase MCP: https://elbowsupknivesout.warreandvavasour.com/mcp",
        "Ask for a morning brief, closing deadlines, or shop-fit matches.",
      ],
      connectorIds: [SHOWCASE_MCP_ID],
      computerEnabled: false,
      createdAt: now + 1,
    },
    {
      id: "tm-builder",
      name: "Builder",
      role: "builder",
      brief:
        "Turns a subscriber's business plan into a product, system, or tool. Uses the local computer after approval.",
      memory: ["Ship working systems, not slide decks."],
      connectorIds: [],
      computerEnabled: true,
      createdAt: now + 2,
    },
  ];
}

function seedConnectors(): Connector[] {
  return [
    {
      id: SHOWCASE_MCP_ID,
      name: "WorkspaceAlberta MCP",
      url: SHOWCASE_MCP_URL,
      kind: "showcase",
      attachedByDefault: true,
      status: "unknown",
      tools: [],
    },
  ];
}

function welcome(tm: Teammate): Message {
  return {
    id: uid("msg"),
    teammateId: tm.id,
    role: "teammate",
    kind: "text",
    text:
      tm.role === "procurement"
        ? "Procurement desk is open. I can list the WorkspaceAlberta showcase MCP, then search CanadaBuys or Alberta tenders after you approve the call."
        : tm.role === "builder"
          ? "Builder desk is open. Give me a plan and I will use this computer — after you approve writes or commands — to start turning it into a thing."
          : "This is the WorkspaceAlberta Terminal. Same shell on every subscriber desk. I keep teammates, a local computer, and MCP connectors. The CanadaBuys MCP is a showcase of what we can wire, not the product you bought.",
    at: Date.now(),
  };
}

export class TerminalStore {
  readonly root: string;
  readonly computer: LocalComputer;
  private state: TerminalState;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root = dataRoot()) {
    this.root = root;
    mkdirSync(join(root, "workspace"), { recursive: true });
    this.computer = new LocalComputer(join(root, "workspace"));
    this.state = this.load();
  }

  snapshot(): TerminalState {
    return {
      ...this.state,
      computer: {
        cwd: this.computer.cwd,
        files: this.computer.list(),
        lastCommand: this.state.computer.lastCommand,
        lastOutput: this.state.computer.lastOutput,
        lastExit: this.state.computer.lastExit,
      },
    };
  }

  teammate(id: string): Teammate | undefined {
    return this.state.teammates.find((t) => t.id === id);
  }

  selected(): Teammate {
    return this.teammate(this.state.selectedId) ?? this.state.teammates[0];
  }

  messages(teammateId: string): Message[] {
    return this.state.messages[teammateId] ?? [];
  }

  connector(id: string): Connector | undefined {
    return this.state.connectors.find((c) => c.id === id);
  }

  approval(id: string): Approval | undefined {
    return this.state.approvals.find((a) => a.id === id);
  }

  select(id: string): void {
    if (!this.teammate(id)) throw new Error("unknown teammate");
    this.state.selectedId = id;
    this.queuePersist();
  }

  createTeammate(input: { name: string; role?: Teammate["role"]; brief?: string }): Teammate {
    const name = input.name.trim();
    if (!name) throw new Error("name is required");
    const role = input.role ?? "custom";
    const tm: Teammate = {
      id: uid("tm"),
      name,
      role,
      brief: (input.brief ?? "").trim() || `${name} — a WorkspaceAlberta teammate.`,
      memory: [],
      connectorIds: this.state.connectors.filter((c) => c.attachedByDefault).map((c) => c.id),
      computerEnabled: role !== "procurement",
      createdAt: Date.now(),
    };
    this.state.teammates.push(tm);
    this.state.messages[tm.id] = [welcome(tm)];
    this.state.selectedId = tm.id;
    this.queuePersist();
    return tm;
  }

  updateTeammate(id: string, patch: Partial<Pick<Teammate, "name" | "role" | "brief" | "connectorIds" | "computerEnabled" | "memory">>): Teammate {
    const tm = this.teammate(id);
    if (!tm) throw new Error("unknown teammate");
    if (patch.name !== undefined) tm.name = patch.name;
    if (patch.role !== undefined) tm.role = patch.role;
    if (patch.brief !== undefined) tm.brief = patch.brief;
    if (patch.connectorIds !== undefined) tm.connectorIds = patch.connectorIds;
    if (patch.computerEnabled !== undefined) tm.computerEnabled = patch.computerEnabled;
    if (patch.memory !== undefined) tm.memory = patch.memory;
    this.queuePersist();
    return tm;
  }

  remember(id: string, note: string): Teammate {
    const text = note.trim();
    if (!text) throw new Error("memory note is empty");
    const tm = this.teammate(id);
    if (!tm) throw new Error("unknown teammate");
    tm.memory = [...tm.memory, text].slice(-40);
    this.queuePersist();
    return tm;
  }

  appendMessage(teammateId: string, msg: Omit<Message, "id" | "at" | "teammateId">): Message {
    if (!this.teammate(teammateId)) throw new Error("unknown teammate");
    const full: Message = { ...msg, id: uid("msg"), teammateId, at: Date.now() };
    this.state.messages[teammateId] = [...this.messages(teammateId), full];
    this.queuePersist();
    return full;
  }

  addConnector(input: { name: string; url: string }): Connector {
    const url = input.url.trim();
    if (!/^https?:\/\//i.test(url)) throw new Error("MCP URL must be http(s)");
    const existing = this.state.connectors.find((c) => c.url === url);
    if (existing) return existing;
    const connector: Connector = {
      id: uid("mcp"),
      name: input.name.trim() || "MCP connector",
      url,
      kind: "mcp",
      attachedByDefault: false,
      status: "unknown",
      tools: [],
    };
    this.state.connectors.push(connector);
    this.queuePersist();
    return connector;
  }

  attachConnector(teammateId: string, connectorId: string, attached: boolean): Teammate {
    const tm = this.teammate(teammateId);
    if (!tm) throw new Error("unknown teammate");
    if (!this.connector(connectorId)) throw new Error("unknown connector");
    const set = new Set(tm.connectorIds);
    if (attached) set.add(connectorId);
    else set.delete(connectorId);
    tm.connectorIds = [...set];
    this.queuePersist();
    return tm;
  }

  async refreshConnector(id: string): Promise<Connector> {
    const connector = this.connector(id);
    if (!connector) throw new Error("unknown connector");
    const client = new McpHttpClient(connector.url);
    try {
      await client.initialize();
      connector.tools = await client.listTools();
      connector.status = "ready";
      connector.lastError = undefined;
      connector.refreshedAt = Date.now();
    } catch (err) {
      connector.status = "error";
      connector.lastError = err instanceof Error ? err.message : String(err);
    }
    this.queuePersist();
    return connector;
  }

  createApproval(input: Omit<Approval, "id" | "status" | "createdAt">): Approval {
    const approval: Approval = {
      ...input,
      id: uid("apr"),
      status: "pending",
      createdAt: Date.now(),
    };
    this.state.approvals.unshift(approval);
    this.appendMessage(input.teammateId, {
      role: "system",
      kind: "approval",
      text: approval.summary,
      approvalId: approval.id,
    });
    this.queuePersist();
    return approval;
  }

  setApproval(id: string, status: "allowed" | "denied", result?: string): Approval {
    const approval = this.approval(id);
    if (!approval) throw new Error("unknown approval");
    approval.status = status;
    approval.resolvedAt = Date.now();
    if (result !== undefined) approval.result = result;
    this.queuePersist();
    return approval;
  }

  recordComputer(command: string, output: string, exit: number): void {
    this.state.computer.lastCommand = command;
    this.state.computer.lastOutput = output;
    this.state.computer.lastExit = exit;
    this.state.computer.cwd = this.computer.cwd;
    this.state.computer.files = this.computer.list();
    this.queuePersist();
  }

  private load(): TerminalState {
    const file = join(this.root, "state.json");
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as TerminalState;
        if (parsed.teammates?.length) {
          parsed.computer = parsed.computer ?? {
            cwd: this.computer.cwd,
            files: this.computer.list(),
          };
          return parsed;
        }
      } catch {
        /* reseed */
      }
    }
    const teammates = seedTeammates();
    const messages: Record<string, Message[]> = {};
    for (const tm of teammates) messages[tm.id] = [welcome(tm)];
    return {
      teammates,
      selectedId: teammates[0].id,
      messages,
      connectors: seedConnectors(),
      approvals: [],
      computer: { cwd: this.computer.cwd, files: this.computer.list() },
    };
  }

  private queuePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), 50);
  }

  persist(): void {
    mkdirSync(this.root, { recursive: true });
    const file = join(this.root, "state.json");
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.snapshot(), null, 2));
    renameSync(tmp, file);
  }
}
