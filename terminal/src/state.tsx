import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./lib/api";
import type { TerminalState } from "./lib/types";

interface TerminalContext {
  state: TerminalState | null;
  connected: boolean;
  error: string | null;
  busy: boolean;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  createTeammate: (name: string, role?: string) => Promise<void>;
  send: (teammateId: string, text: string) => Promise<void>;
  remember: (teammateId: string, text: string) => Promise<void>;
  addConnector: (name: string, url: string, teammateId?: string) => Promise<void>;
  attach: (connectorId: string, teammateId: string, attached: boolean) => Promise<void>;
  refreshConnector: (connectorId: string) => Promise<void>;
  requestExec: (command: string, teammateId: string) => Promise<void>;
  decide: (approvalId: string, decision: "allow" | "deny") => Promise<void>;
}

const Ctx = createContext<TerminalContext | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TerminalState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const next = await api<TerminalState>("/api/state");
    setState(next);
    setConnected(true);
    setError(null);
  };

  useEffect(() => {
    void refresh().catch((err: Error) => {
      setError(err.message);
      setConnected(false);
    });
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as { kind?: string; state?: TerminalState };
        if (payload.state) {
          setState(payload.state);
          setConnected(true);
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo<TerminalContext>(
    () => ({
      state,
      connected,
      error,
      busy,
      refresh,
      select: (id) => wrap(() => api(`/api/teammates/${id}/select`, { method: "POST" })),
      createTeammate: (name, role) =>
        wrap(() => api("/api/teammates", { method: "POST", body: JSON.stringify({ name, role }) })),
      send: (teammateId, text) =>
        wrap(() =>
          api(`/api/teammates/${teammateId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
        ),
      remember: (teammateId, text) =>
        wrap(() =>
          api(`/api/teammates/${teammateId}/memory`, { method: "POST", body: JSON.stringify({ text }) }),
        ),
      addConnector: (name, url, teammateId) =>
        wrap(() => api("/api/connectors", { method: "POST", body: JSON.stringify({ name, url, teammateId }) })),
      attach: (connectorId, teammateId, attached) =>
        wrap(() =>
          api(`/api/connectors/${connectorId}/attach`, {
            method: "POST",
            body: JSON.stringify({ teammateId, attached }),
          }),
        ),
      refreshConnector: (connectorId) =>
        wrap(() => api(`/api/connectors/${connectorId}/refresh`, { method: "POST" })),
      requestExec: (command, teammateId) =>
        wrap(() => api("/api/computer/exec", { method: "POST", body: JSON.stringify({ command, teammateId }) })),
      decide: (approvalId, decision) =>
        wrap(() =>
          api(`/api/approvals/${approvalId}`, { method: "POST", body: JSON.stringify({ decision }) }),
        ),
    }),
    [state, connected, error, busy],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTerminal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTerminal outside provider");
  return ctx;
}
