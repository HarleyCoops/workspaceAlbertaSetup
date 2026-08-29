export type Role = "operator" | "procurement" | "builder" | "custom";

export type ApprovalKind = "mcp_call" | "computer_exec" | "computer_write";
export type ApprovalStatus = "pending" | "allowed" | "denied";

export interface Message {
  id: string;
  teammateId: string;
  role: "user" | "teammate" | "system";
  kind: "text" | "activity" | "approval";
  text?: string;
  activity?: { label: string; ok?: boolean };
  approvalId?: string;
  at: number;
}

export interface Teammate {
  id: string;
  name: string;
  role: Role;
  brief: string;
  memory: string[];
  connectorIds: string[];
  computerEnabled: boolean;
  createdAt: number;
}

export interface Connector {
  id: string;
  name: string;
  url: string;
  kind: "showcase" | "mcp";
  attachedByDefault: boolean;
  status: "unknown" | "ready" | "error";
  lastError?: string;
  tools: McpTool[];
  refreshedAt?: number;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface Approval {
  id: string;
  teammateId: string;
  kind: ApprovalKind;
  title: string;
  summary: string;
  status: ApprovalStatus;
  connectorId?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  command?: string;
  path?: string;
  contents?: string;
  createdAt: number;
  resolvedAt?: number;
  result?: string;
}

export interface ComputerSnapshot {
  cwd: string;
  files: string[];
  lastCommand?: string;
  lastOutput?: string;
  lastExit?: number;
}

export interface TerminalState {
  teammates: Teammate[];
  selectedId: string;
  messages: Record<string, Message[]>;
  connectors: Connector[];
  approvals: Approval[];
  computer: ComputerSnapshot;
}

export const SHOWCASE_MCP_URL =
  process.env.WA_SHOWCASE_MCP_URL || "https://elbowsupknivesout.warreandvavasour.com/mcp";

export const SHOWCASE_MCP_ID = "wa-showcase";
