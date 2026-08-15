// App-level settings, in the right-side slot: credentials shared by all
// bots. Per-bot settings (name, persona, model, computer) live in
// SettingsPanel; e2b sandbox key entry also stays in ComputerPanel.
import { X } from "lucide-react";
import { useStore } from "@/state/store";
import { ApiKeyRow } from "./ApiKeys";

export function AppSettingsPanel() {
  const { dispatch } = useStore();

  return (
    <aside className="animate-panel-in flex h-full w-[400px] shrink-0 flex-col border-l border-hairline/40 bg-panel">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="w-6" />
        <span className="text-[15px] font-semibold text-ink">App Settings</span>
        <button
          onClick={() => dispatch({ type: "toggleAppSettings", open: false })}
          className="rounded-md p-1 text-ink-secondary hover:bg-raised hover:text-ink"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {/* Hugging Face — optional inference (Claude/Codex are the default engines) */}
        <div className="mt-2 rounded-xl bg-card p-4">
          <div className="text-[15px] font-medium text-ink">Hugging Face</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            Optional open-source inference (GLM 4.6 and other router models). Get your token at{" "}
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              huggingface.co/settings/tokens
            </a>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <ApiKeyRow section="hf" label="Hugging Face token" placeholder="hf_…" />
            <ApiKeyRow
              section="hfUrl"
              label="Base URL (optional)"
              placeholder="https://router.huggingface.co/v1"
              type="text"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-card p-4">
          <div className="text-[15px] font-medium text-ink">DeepSeek</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            Optional paid inference (DeepSeek V4 Pro / Flash). Not the boot default — Claude/Codex are.
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <ApiKeyRow section="deepseek" label="DeepSeek API key" placeholder="sk-…" />
          </div>
        </div>

        {/* Other connections */}
        <div className="mt-4 rounded-xl bg-card p-4">
          <div className="text-[15px] font-medium text-ink">Connected Apps</div>
          <div className="mt-0.5 text-[13px] text-ink-secondary">
            Optional integrations. Keys are stored locally and never shown again.
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <ApiKeyRow section="composio" label="Composio Connect key" placeholder="ck_…" />
            <ApiKeyRow
              section="composioApi"
              label="Composio API key (optional)"
              placeholder="ak_…  unlocks the full app catalog"
            />
            <ApiKeyRow section="e2b" label="e2b API key" placeholder="e2b_…  for cloud sandboxes" />
          </div>
        </div>

        {/* About */}
        <div className="mt-4 rounded-xl bg-card p-4">
          <div className="text-[15px] font-medium text-ink">About WorkspaceAlberta</div>
          <div className="mt-2 text-[13px] text-ink-secondary leading-relaxed">
            Linux-first CEO productivity chat app. Tool mesh via Claude or Codex CLI; Hugging Face is optional inference.
            <br /><br />
            Based on{" "}
            <a
              href="https://github.com/milind-soni/OpenMausBot"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              OpenMausBot
            </a>{" "}
            by Milind Soni. Licensed under MIT.
          </div>
        </div>
      </div>
    </aside>
  );
}
