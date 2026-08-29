import { useState } from "react";
import { Plus } from "lucide-react";
import { useTerminal } from "../state";
import type { Role, Teammate } from "../lib/types";

const ROLES: Role[] = ["operator", "procurement", "builder", "custom"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function TeammateRow({ teammate }: { teammate: Teammate }) {
  const { state, select } = useTerminal();
  const selected = state?.selectedId === teammate.id;
  const last = (state?.messages[teammate.id] ?? []).at(-1);
  return (
    <button
      type="button"
      onClick={() => void select(teammate.id)}
      className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left ${
        selected ? "bg-lift" : "hover:bg-lift/60"
      }`}
    >
      <span
        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
          selected ? "bg-brass text-void" : "bg-void text-brass"
        }`}
      >
        {initials(teammate.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[14px] font-medium text-paper">{teammate.name}</span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-mute">{teammate.role}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-mute">
          {last?.text || last?.activity?.label || teammate.brief}
        </span>
      </span>
    </button>
  );
}

export function TeammateRail() {
  const { state, createTeammate } = useTerminal();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("custom");

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-line bg-rail">
      <div className="px-4 pb-3 pt-5">
        <div className="font-display text-[22px] leading-none text-paper">WorkspaceAlberta</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-brass">Terminal</div>
        <p className="mt-3 text-[12px] leading-relaxed text-mute">
          Same dedicated AI desk for every subscriber. Warre &amp; Vavasour turns plans into products.
        </p>
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Teammates</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1 text-mute hover:bg-lift hover:text-paper"
          title="New teammate"
        >
          <Plus size={16} />
        </button>
      </div>

      {open && (
        <form
          className="mx-3 mb-3 space-y-2 rounded-lg border border-line bg-void p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void createTeammate(name.trim(), role).then(() => {
              setName("");
              setOpen(false);
            });
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-md border border-line bg-shell px-2.5 py-1.5 text-[13px] text-paper placeholder:text-mute focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-md border border-line bg-shell px-2.5 py-1.5 text-[13px] text-paper focus:outline-none"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="w-full rounded-md bg-brass py-1.5 text-[12px] font-medium text-void"
          >
            Create teammate
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto px-2">
        {(state?.teammates ?? []).map((tm) => (
          <TeammateRow key={tm.id} teammate={tm} />
        ))}
      </div>

      <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-mute">
        Warre &amp; Vavasour · Christian Cooper
        <div className="mt-1 font-mono text-[10px] text-brass-dim">subscriber shell · not the leftover chat</div>
      </div>
    </aside>
  );
}
