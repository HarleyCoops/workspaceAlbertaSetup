// Composio — two clients in one file:
//  1) the Connect meta-MCP (connect.composio.dev) for connection state +
//     auth links, ported from agentcal src/composio.js
//  2) the v3 toolkits catalog (backend.composio.dev) for the plugin
//     marketplace — names, descriptions, logos. Works when the key is a
//     project API key; when it isn't, the caller falls back to the curated
//     catalog below (logos then resolve via favicon fallback client-side).
import type { AppConfig } from "./config.ts";

const CONNECT_URL = "https://connect.composio.dev/mcp";
const BACKEND_URL = "https://backend.composio.dev/api/v3";

export interface ComposioAuth {
  key: string;
  url?: string;
}

export interface OpenAIFunctionTool {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

/** The 7 Composio Connect meta-tools the OpenAI-compatible drivers expose. */
export const COMPOSIO_META_TOOLS = [
  "COMPOSIO_SEARCH_TOOLS",
  "COMPOSIO_GET_TOOL_SCHEMAS",
  "COMPOSIO_MULTI_EXECUTE_TOOL",
  "COMPOSIO_MANAGE_CONNECTIONS",
  "COMPOSIO_WAIT_FOR_CONNECTIONS",
  "COMPOSIO_REMOTE_WORKBENCH",
  "COMPOSIO_REMOTE_BASH_TOOL",
] as const;

export const COMPOSIO_SYSTEM_HINT =
  "You have Composio Connect tools for Gmail, Google Drive, Slack, GitHub, Calendar, and other connected apps. " +
  "When the user mentions any external app or data, call COMPOSIO_SEARCH_TOOLS first, then execute via COMPOSIO_MULTI_EXECUTE_TOOL. " +
  "Never claim you lack access before searching tools and checking connections. " +
  "If a toolkit is not connected, use COMPOSIO_MANAGE_CONNECTIONS and show the user the auth link as markdown.";

const FALLBACK_DESCRIPTIONS: Record<(typeof COMPOSIO_META_TOOLS)[number], string> = {
  COMPOSIO_SEARCH_TOOLS:
    "Discover tools for Gmail, Google Drive, Slack, GitHub, and 500+ apps. Always call this first when the user mentions an external app. Never say you lack access before calling it.",
  COMPOSIO_GET_TOOL_SCHEMAS: "Retrieve input schemas for tool slugs returned by COMPOSIO_SEARCH_TOOLS. Never invent slugs.",
  COMPOSIO_MULTI_EXECUTE_TOOL: "Execute one or more discovered toolkit tools (Gmail, Drive, Slack, GitHub, …) in parallel.",
  COMPOSIO_MANAGE_CONNECTIONS: "Add, list, rename, or remove app connections. Show any returned auth URL as a markdown link.",
  COMPOSIO_WAIT_FOR_CONNECTIONS: "Wait until the user finishes connecting an app after COMPOSIO_MANAGE_CONNECTIONS.",
  COMPOSIO_REMOTE_WORKBENCH: "Run Python in a remote sandbox for large or bulk Composio tool results.",
  COMPOSIO_REMOTE_BASH_TOOL: "Run bash in a remote sandbox for file or data processing of large tool results.",
};

export function fallbackComposioOpenAITools(): OpenAIFunctionTool[] {
  return COMPOSIO_META_TOOLS.map((name) => ({
    type: "function" as const,
    function: {
      name,
      description: FALLBACK_DESCRIPTIONS[name],
      parameters: { type: "object", additionalProperties: true },
    },
  }));
}

function parseMcpResponse(text: string) {
  // Streamable-HTTP servers answer JSON or SSE (`data: {...}` lines).
  const line = text.startsWith("{")
    ? text
    : text.split("\n").find((l) => l.startsWith("data: "))?.slice(6);
  if (!line) throw new Error("empty MCP response");
  const msg = JSON.parse(line);
  if (msg.error) throw new Error(msg.error.message || "MCP error");
  const content = msg.result?.content?.find((c: any) => c.type === "text")?.text;
  if (!content) return msg.result ?? null;
  try {
    return JSON.parse(content);
  } catch {
    return { text: content };
  }
}

function timeoutForTool(name: string): number {
  if (name === "COMPOSIO_WAIT_FOR_CONNECTIONS") return 120_000;
  if (name === "COMPOSIO_REMOTE_BASH_TOOL" || name === "COMPOSIO_REMOTE_WORKBENCH") return 180_000;
  return 30_000;
}

export async function composioRpc(
  auth: ComposioAuth,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 30_000,
) {
  if (!auth.key) {
    throw new Error('no Composio key configured — add {"composio":{"key":"ck_…"}} to ~/.config/workspacealberta/config.json');
  }
  const res = await fetch(auth.url || CONNECT_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-consumer-api-key": auth.key,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Composio MCP: HTTP ${res.status}`);
  return parseMcpResponse(await res.text());
}

export async function composioCall(auth: ComposioAuth, name: string, args: unknown) {
  return composioRpc(auth, "tools/call", { name, arguments: args ?? {} }, timeoutForTool(name));
}

export async function composioTool(cfg: AppConfig, name: string, args: unknown) {
  if (!cfg.composio?.key) {
    throw new Error('no Composio key configured — add {"composio":{"key":"ck_…"}} to ~/.config/workspacealberta/config.json');
  }
  return composioCall({ key: cfg.composio.key, url: cfg.composio.url }, name, args);
}

function mcpToOpenAI(tool: { name?: string; description?: string; inputSchema?: Record<string, unknown> }): OpenAIFunctionTool | null {
  if (!tool.name) return null;
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema ?? { type: "object", additionalProperties: true },
    },
  };
}

/** OpenAI `tools` array for Connect meta-tools. Prefers live MCP tools/list. */
export async function composioOpenAITools(auth: ComposioAuth): Promise<OpenAIFunctionTool[]> {
  const fallback = fallbackComposioOpenAITools();
  try {
    const result = await composioRpc(auth, "tools/list", {}, 15_000);
    const listed: unknown[] = Array.isArray(result?.tools) ? result.tools : [];
    const converted: OpenAIFunctionTool[] = listed
      .filter((t): t is { name: string; description?: string; inputSchema?: Record<string, unknown> } =>
        typeof t === "object" && t !== null && typeof (t as { name?: unknown }).name === "string" && (t as { name: string }).name.startsWith("COMPOSIO_"),
      )
      .map(mcpToOpenAI)
      .filter((t): t is OpenAIFunctionTool => t !== null);
    if (!converted.length) return fallback;
    const byName = new Map<string, OpenAIFunctionTool>(converted.map((t) => [t.function.name, t]));
    for (const fb of fallback) {
      if (!byName.has(fb.function.name)) byName.set(fb.function.name, fb);
    }
    return [...byName.values()];
  } catch {
    return fallback;
  }
}

/** Connection status per service slug: { slack: { connected, status } }. */
export async function connectionStatus(cfg: AppConfig, slugs: string[]) {
  const out = await composioTool(cfg, "COMPOSIO_MANAGE_CONNECTIONS", {
    toolkits: slugs.map((name) => ({ name, action: "list" })),
  });
  const results = out?.data?.results ?? {};
  const status: Record<string, { connected: boolean; status: string }> = {};
  for (const slug of slugs) {
    const r = results[slug];
    const active =
      (r?.accounts ?? []).some((a: any) => /active/i.test(a.status ?? "")) || /^active$/i.test(r?.status ?? "");
    status[slug] = { connected: active, status: r?.status ?? "unknown" };
  }
  return status;
}

/** Disconnect a service: remove every connected account for the slug. */
export async function removeService(cfg: AppConfig, slug: string) {
  const out = await composioTool(cfg, "COMPOSIO_MANAGE_CONNECTIONS", {
    toolkits: [{ name: slug, action: "list" }],
  });
  const accounts = out?.data?.results?.[slug]?.accounts ?? [];
  const ids = accounts.map((a: any) => a.id ?? a.account_id ?? a.nanoid).filter(Boolean);
  for (const id of ids) {
    await composioTool(cfg, "COMPOSIO_MANAGE_CONNECTIONS", {
      toolkits: [{ name: slug, action: "remove", account_id: id }],
    });
  }
  return { removed: ids.length };
}

/** Mint a browser auth link for one service. Returns { url } or throws. */
export async function authorizeService(cfg: AppConfig, slug: string) {
  const out = await composioTool(cfg, "COMPOSIO_MANAGE_CONNECTIONS", {
    toolkits: [{ name: slug, action: "add" }],
  });
  // be liberal: any https URL mentioning composio/auth wins, else the first
  const raw = JSON.stringify(out);
  const urls = raw.match(/https:\/\/[^"\\\s]+/g) ?? [];
  const url = urls.find((u) => /composio|connect|auth/i.test(u)) ?? urls[0];
  if (!url) throw new Error(`Composio returned no auth link for ${slug}`);
  return { url };
}

// ── marketplace catalog ────────────────────────────────────────────────
export interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  logo: string | null;
  /** used for the client-side favicon fallback when logo is null/broken */
  domain: string | null;
}

// Curated fallback — the services agentcal's connectors page ships plus the
// long marketplace tail. Logos resolve client-side:
// logo → favicon(domain) → monogram.
const CURATED: ToolkitCard[] = [
  { slug: "slack", label: "Slack", blurb: "Post updates and read channels", domain: "slack.com", logo: null },
  { slug: "github", label: "GitHub", blurb: "Issues, pull requests, and code", domain: "github.com", logo: null },
  { slug: "gmail", label: "Gmail", blurb: "Read and send email", domain: "gmail.com", logo: null },
  { slug: "googlecalendar", label: "Google Calendar", blurb: "Read and create events", domain: "calendar.google.com", logo: null },
  { slug: "googlesheets", label: "Google Sheets", blurb: "Read and update spreadsheets", domain: "sheets.google.com", logo: null },
  { slug: "googledocs", label: "Google Docs", blurb: "Read and write documents", domain: "docs.google.com", logo: null },
  { slug: "googledrive", label: "Google Drive", blurb: "Browse and manage files", domain: "drive.google.com", logo: null },
  { slug: "notion", label: "Notion", blurb: "Pages and databases", domain: "notion.so", logo: null },
  { slug: "linear", label: "Linear", blurb: "Issues and project tracking", domain: "linear.app", logo: null },
  { slug: "sentry", label: "Sentry", blurb: "Errors and alerts", domain: "sentry.io", logo: null },
  { slug: "posthog", label: "PostHog", blurb: "Analytics, feature flags, experiments", domain: "posthog.com", logo: null },
  { slug: "discord", label: "Discord", blurb: "Messages and channels", domain: "discord.com", logo: null },
  { slug: "x", label: "X (Twitter)", blurb: "Post and read on X", domain: "x.com", logo: null },
  { slug: "reddit", label: "Reddit", blurb: "Browse and post", domain: "reddit.com", logo: null },
  { slug: "zapier", label: "Zapier", blurb: "Connect 9,000+ apps", domain: "zapier.com", logo: null },
  { slug: "hubspot", label: "HubSpot", blurb: "CRM search & updates", domain: "hubspot.com", logo: null },
  { slug: "salesforce", label: "Salesforce", blurb: "CRM records and reports", domain: "salesforce.com", logo: null },
  { slug: "jira", label: "Jira", blurb: "Issues and sprints", domain: "atlassian.com", logo: null },
  { slug: "asana", label: "Asana", blurb: "Tasks and projects", domain: "asana.com", logo: null },
  { slug: "trello", label: "Trello", blurb: "Boards and cards", domain: "trello.com", logo: null },
  { slug: "dropbox", label: "Dropbox", blurb: "Files and folders", domain: "dropbox.com", logo: null },
  { slug: "airtable", label: "Airtable", blurb: "Bases and records", domain: "airtable.com", logo: null },
  { slug: "figma", label: "Figma", blurb: "Files and comments", domain: "figma.com", logo: null },
  { slug: "stripe", label: "Stripe", blurb: "Payments and customers", domain: "stripe.com", logo: null },
];

let toolkitCache: { at: number; cards: ToolkitCard[] } | null = null;

/**
 * Marketplace catalog. Tries the v3 toolkits API (official names,
 * descriptions, logos — cached 10 min); falls back to the curated list.
 */
export async function listToolkits(cfg: AppConfig): Promise<{ cards: ToolkitCard[]; source: "api" | "curated" }> {
  if (toolkitCache && Date.now() - toolkitCache.at < 10 * 60_000) {
    return { cards: toolkitCache.cards, source: "api" };
  }
  const backendKey = cfg.composio?.apiKey ?? cfg.composio?.key;
  if (backendKey) {
    try {
      const res = await fetch(`${BACKEND_URL}/toolkits?limit=500&sort_by=usage`, {
        headers: { "x-api-key": backendKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const json: any = await res.json();
        const items = json.items ?? json.data ?? [];
        if (Array.isArray(items) && items.length) {
          const cards: ToolkitCard[] = items.map((t: any) => ({
            slug: (t.slug ?? t.key ?? t.name ?? "").toLowerCase(),
            label: t.name ?? t.slug ?? "",
            blurb: (t.meta?.description ?? t.description ?? "").slice(0, 90),
            logo: t.meta?.logo ?? t.logo ?? null,
            domain: null,
          }));
          toolkitCache = { at: Date.now(), cards };
          return { cards, source: "api" };
        }
      }
    } catch {
      /* fall through to curated */
    }
  }
  return { cards: CURATED, source: "curated" };
}

export const CURATED_SLUGS = CURATED.map((c) => c.slug);
