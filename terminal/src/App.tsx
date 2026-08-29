import { Loader2 } from "lucide-react";
import { Inspector } from "./components/Inspector";
import { TeammateRail } from "./components/TeammateRail";
import { ThreadView } from "./components/ThreadView";
import { TerminalProvider, useTerminal } from "./state";

function Shell() {
  const { state, connected, error } = useTerminal();
  if (!state) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-void text-mute">
        <Loader2 className="animate-spin" size={18} />
        <div>{connected ? "Loading terminal…" : "Connecting to the WorkspaceAlberta Terminal harness…"}</div>
        <div className="font-mono text-[12px]">
          {error ?? "pnpm terminal · harness 127.0.0.1:8899 · UI 127.0.0.1:5299"}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full">
      <TeammateRail />
      <ThreadView />
      <Inspector />
    </div>
  );
}

export function App() {
  return (
    <TerminalProvider>
      <Shell />
    </TerminalProvider>
  );
}
