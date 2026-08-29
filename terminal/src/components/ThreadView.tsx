import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useTerminal } from "../state";
import type { Approval, Message } from "../lib/types";

function ApprovalCard({ approval }: { approval: Approval }) {
  const { decide, busy } = useTerminal();
  const pending = approval.status === "pending";
  return (
    <div className="rounded-xl border border-brass/40 bg-lift p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">Approval gate</div>
      <div className="mt-1 text-[15px] font-medium text-paper">{approval.title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-mute">{approval.summary}</p>
      {approval.command && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-void px-3 py-2 font-mono text-[12px] text-brass">
          {approval.command}
        </pre>
      )}
      {approval.toolName && (
        <pre className="mt-3 overflow-x-auto rounded-md bg-void px-3 py-2 font-mono text-[12px] text-brass">
          {approval.toolName}
          {approval.toolArgs ? ` ${JSON.stringify(approval.toolArgs)}` : ""}
        </pre>
      )}
      {pending ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(approval.id, "allow")}
            className="rounded-md bg-brass px-3 py-1.5 text-[12px] font-medium text-void disabled:opacity-50"
          >
            Allow
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void decide(approval.id, "deny")}
            className="rounded-md border border-line px-3 py-1.5 text-[12px] text-paper disabled:opacity-50"
          >
            Deny
          </button>
        </div>
      ) : (
        <div className={`mt-3 text-[12px] ${approval.status === "allowed" ? "text-ok" : "text-stop"}`}>
          {approval.status === "allowed" ? "Allowed" : "Denied"}
          {approval.result ? ` · ${approval.result.slice(0, 160)}` : ""}
        </div>
      )}
    </div>
  );
}

function Bubble({ message, approval }: { message: Message; approval?: Approval }) {
  if (message.kind === "approval" && approval) {
    return <ApprovalCard approval={approval} />;
  }
  if (message.kind === "activity") {
    const ok = message.activity?.ok;
    return (
      <div className="rounded-xl border border-line bg-shell px-3 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass-dim">
          {message.activity?.label ?? "activity"}
          {ok === true ? " · ok" : ok === false ? " · failed" : ""}
        </div>
        {message.text && (
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-paper">
            {message.text}
          </pre>
        )}
      </div>
    );
  }
  const mine = message.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${
          mine ? "bg-brass text-void" : "bg-lift text-paper"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

export function ThreadView() {
  const { state, send, busy } = useTerminal();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const tm = state?.teammates.find((t) => t.id === state.selectedId) ?? state?.teammates[0];
  const messages = tm ? (state?.messages[tm.id] ?? []) : [];
  const approvals = state?.approvals ?? [];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, tm?.id]);

  if (!tm) {
    return (
      <main className="flex flex-1 items-center justify-center bg-shell text-mute">
        Create a teammate to begin.
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-shell">
      <header className="flex items-center justify-between border-b border-line px-5 py-3">
        <div>
          <div className="text-[16px] font-medium text-paper">{tm.name}</div>
          <div className="text-[12px] text-mute">{tm.brief}</div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">{tm.role}</div>
      </header>

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.map((m) => (
          <Bubble key={m.id} message={m} approval={approvals.find((a) => a.id === m.approvalId)} />
        ))}
      </div>

      <form
        className="border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          void send(tm.id, text);
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-void px-3 py-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            placeholder="Message this teammate — list the showcase MCP, search tenders, or run a computer command"
            className="max-h-32 min-h-[52px] flex-1 resize-none bg-transparent py-1 text-[14px] text-paper placeholder:text-mute focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="mb-0.5 rounded-md bg-brass p-2 text-void disabled:opacity-40"
            title="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </main>
  );
}
