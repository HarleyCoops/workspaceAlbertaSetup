import { useState } from "react";
import { Cable, Monitor, UserRound } from "lucide-react";
import { useTerminal } from "../state";

type Tab = "profile" | "computer" | "connectors";

export function Inspector() {
  const { state, remember, addConnector, attach, refreshConnector, requestExec, busy } = useTerminal();
  const [tab, setTab] = useState<Tab>("connectors");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("https://elbowsupknivesout.warreandvavasour.com/mcp");
  const [label, setLabel] = useState("WorkspaceAlberta MCP");
  const [command, setCommand] = useState("echo WorkspaceAlberta Terminal");

  const tm = state?.teammates.find((t) => t.id === state.selectedId) ?? state?.teammates[0];
  if (!tm || !state) return null;

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-line bg-rail">
      <div className="flex border-b border-line">
        {(
          [
            ["profile", UserRound, "Profile"],
            ["computer", Monitor, "Computer"],
            ["connectors", Cable, "Connectors"],
          ] as const
        ).map(([id, Icon, title]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-[11px] uppercase tracking-[0.12em] ${
              tab === id ? "border-b-2 border-brass text-paper" : "text-mute hover:text-paper"
            }`}
          >
            <Icon size={13} />
            {title}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "profile" && (
          <div className="space-y-4">
            <section>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Role</div>
              <div className="mt-1 text-[14px] text-paper">{tm.role}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-mute">{tm.brief}</p>
            </section>
            <section>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Memory</div>
              <ul className="mt-2 space-y-1.5 text-[13px] text-paper">
                {tm.memory.length === 0 && <li className="text-mute">No notes yet.</li>}
                {tm.memory.map((m) => (
                  <li key={m} className="rounded-md bg-void px-2.5 py-1.5">
                    {m}
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!note.trim()) return;
                  void remember(tm.id, note.trim()).then(() => setNote(""));
                }}
              >
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a memory"
                  className="flex-1 rounded-md border border-line bg-void px-2.5 py-1.5 text-[13px] text-paper placeholder:text-mute focus:outline-none"
                />
                <button type="submit" className="rounded-md bg-lift px-2.5 text-[12px] text-paper">
                  Save
                </button>
              </form>
            </section>
            <section>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Tools</div>
              <p className="mt-2 text-[13px] text-mute">
                Computer: {tm.computerEnabled ? "enabled" : "off"}
              </p>
              <p className="mt-1 text-[13px] text-mute">
                Connectors:{" "}
                {tm.connectorIds.map((id) => state.connectors.find((c) => c.id === id)?.name).filter(Boolean).join(", ") ||
                  "none"}
              </p>
            </section>
          </div>
        )}

        {tab === "computer" && (
          <div className="space-y-4">
            <p className="text-[12px] leading-relaxed text-mute">
              Local harness this teammate can use. Writes and commands wait behind the approval gate. Not official DSH.
            </p>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Workspace</div>
              <pre className="mt-1 overflow-x-auto font-mono text-[11px] text-brass">{state.computer.cwd}</pre>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Files</div>
              <ul className="mt-1 font-mono text-[12px] text-paper">
                {state.computer.files.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            {state.computer.lastOutput && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
                  Last {state.computer.lastCommand}
                </div>
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-void p-2 font-mono text-[11px] text-paper">
                  {state.computer.lastOutput}
                </pre>
              </div>
            )}
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!command.trim()) return;
                void requestExec(command.trim(), tm.id);
              }}
            >
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full rounded-md border border-line bg-void px-2.5 py-1.5 font-mono text-[12px] text-paper focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !tm.computerEnabled}
                className="w-full rounded-md bg-brass py-1.5 text-[12px] font-medium text-void disabled:opacity-40"
              >
                Request run (approval)
              </button>
            </form>
          </div>
        )}

        {tab === "connectors" && (
          <div className="space-y-4">
            <p className="text-[12px] leading-relaxed text-mute">
              MCP only — no second tool mesh. The WorkspaceAlberta CanadaBuys endpoint is a{" "}
              <span className="text-brass">showcase connector</span>, not the SKU.
            </p>
            {state.connectors.map((c) => {
              const attached = tm.connectorIds.includes(c.id);
              return (
                <div key={c.id} className="rounded-xl border border-line bg-void p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[14px] text-paper">{c.name}</div>
                      <div className="font-mono text-[10px] text-brass-dim">
                        {c.kind === "showcase" ? "showcase" : "mcp"} · {c.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void attach(c.id, tm.id, !attached)}
                      className="rounded-md border border-line px-2 py-1 text-[11px] text-paper"
                    >
                      {attached ? "Detach" : "Attach"}
                    </button>
                  </div>
                  <div className="mt-2 break-all font-mono text-[11px] text-mute">{c.url}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void refreshConnector(c.id)}
                      className="rounded-md bg-lift px-2 py-1 text-[11px] text-paper"
                    >
                      List tools
                    </button>
                  </div>
                  {c.lastError && <p className="mt-2 text-[12px] text-stop">{c.lastError}</p>}
                  {c.tools.length > 0 && (
                    <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[12px] text-paper">
                      {c.tools.map((t) => (
                        <li key={t.name}>
                          <span className="font-mono text-brass">{t.name}</span>
                          <span className="text-mute"> — {t.description.slice(0, 90)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            <form
              className="space-y-2 rounded-xl border border-dashed border-line p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!url.trim()) return;
                void addConnector(label.trim() || "MCP connector", url.trim(), tm.id);
              }}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Add MCP URL</div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-line bg-void px-2.5 py-1.5 text-[13px] text-paper focus:outline-none"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/mcp"
                className="w-full rounded-md border border-line bg-void px-2.5 py-1.5 font-mono text-[12px] text-paper focus:outline-none"
              />
              <button type="submit" className="w-full rounded-md bg-lift py-1.5 text-[12px] text-paper">
                Add and attach
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
