// Hugging Face driver — OpenAI-compatible chat/completions API with SSE streaming.
// Uses Hugging Face Inference Providers (router.huggingface.co) by default,
// supporting open-source models like Llama, Mistral, Qwen, and more.
// EU-pinnable: operators can point the base URL at dedicated inference endpoints.
import type {
  DriverCreateInput,
  ProviderDriver,
  ProviderInstance,
  ProviderSnapshot,
  RuntimeEvent,
  RuntimeEventListener,
  SendTurnInput,
} from "../contracts.ts";
import { newEventId, newId } from "../contracts.ts";
import { appendNative } from "./native.ts";

const DRIVER_KIND = "huggingface";
const DEFAULT_URL = "https://router.huggingface.co/v1";

// Curated open-source models available on Hugging Face Inference Providers.
// These are chat-capable instruction models that work with the OpenAI-compatible API.
// Operators can also point at custom endpoints with other models.
const MODELS = {
  default: "meta-llama/Llama-3.3-70B-Instruct",
  options: [
    { id: "meta-llama/Llama-3.3-70B-Instruct", label: "Llama 3.3 70B" },
    { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B" },
    { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen 2.5 72B" },
    { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B" },
    { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B v0.3" },
    { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Mixtral 8x7B" },
    { id: "google/gemma-2-27b-it", label: "Gemma 2 27B" },
    { id: "google/gemma-2-9b-it", label: "Gemma 2 9B" },
    { id: "microsoft/Phi-3.5-mini-instruct", label: "Phi 3.5 Mini" },
  ],
};

export interface HuggingFaceConfig {
  url: string;
  /** resolved at create-time from instance environment / app config */
  apiKeyEnv: string;
}

function decodeConfig(raw: unknown): HuggingFaceConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    url: typeof o.url === "string" ? o.url : DEFAULT_URL,
    apiKeyEnv: typeof o.apiKeyEnv === "string" ? o.apiKeyEnv : "HF_TOKEN",
  };
}

export const HuggingFaceDriver: ProviderDriver<HuggingFaceConfig> = {
  driverKind: DRIVER_KIND,
  metadata: { displayName: "Hugging Face", supportsMultipleInstances: true },
  models: MODELS,
  decodeConfig,
  defaultConfig: () => decodeConfig({}),

  async create(input: DriverCreateInput<HuggingFaceConfig>): Promise<ProviderInstance> {
    const { instanceId, config } = input;
    // Check both the configured env var name AND common alternatives
    const apiKey =
      input.environment[config.apiKeyEnv] ??
      process.env[config.apiKeyEnv] ??
      input.environment.HF_TOKEN ??
      process.env.HF_TOKEN ??
      input.environment.HUGGINGFACE_TOKEN ??
      process.env.HUGGINGFACE_TOKEN ??
      "";
    const listeners = new Set<RuntimeEventListener>();
    const active = new Map<string, { abort: AbortController; turnId: string }>();

    const emit = (event: RuntimeEvent) => {
      for (const l of [...listeners]) l(event);
    };
    const base = (threadId: string, turnId: string) => ({
      eventId: newEventId(),
      provider: DRIVER_KIND,
      threadId,
      turnId,
      createdAt: new Date().toISOString(),
    });

    const complete = async (
      messages: Array<{ role: string; content: string }>,
      model: string,
      opts: { stream: boolean; signal?: AbortSignal; onDelta?: (d: string) => void },
    ): Promise<{ text: string; usage: { input: number; output: number } | null }> => {
      const res = await fetch(`${config.url}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          stream: opts.stream,
          max_tokens: 4096,
        }),
        signal: opts.signal ?? AbortSignal.timeout(180_000), // Longer timeout for large models
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Hugging Face HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
      }
      if (!opts.stream) {
        const json: any = await res.json();
        return {
          text: json.choices?.[0]?.message?.content ?? "",
          usage: json.usage
            ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
            : null,
        };
      }
      let text = "";
      let usage: { input: number; output: number } | null = null;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          let chunk: any;
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            opts.onDelta?.(delta);
          }
          if (chunk.usage) {
            usage = { input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0 };
          }
        }
      }
      return { text, usage };
    };

    const sendTurn = async (turn: SendTurnInput) => {
      const { threadId } = turn;
      if (!apiKey) throw new Error(`no Hugging Face token — set HF_TOKEN or add hf.key to config.json`);
      if (active.has(threadId)) throw new Error("a turn is already running on this thread");
      const turnId = newId();
      const abort = new AbortController();
      active.set(threadId, { abort, turnId });

      const messages = [
        ...(turn.system ? [{ role: "system", content: turn.system }] : []),
        ...(turn.transcript ?? []).map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.text,
        })),
        { role: "user", content: turn.text },
      ];
      appendNative(threadId, { dir: "out", source: "hf.chat.completions", msg: { model: turn.model, messages } });

      emit({ ...base(threadId, turnId), type: "turn.started" });
      emit({ ...base(threadId, turnId), type: "session.started", sessionId: null, model: turn.model ?? MODELS.default });

      (async () => {
        try {
          const { text, usage } = await complete(messages, turn.model || MODELS.default, {
            stream: true,
            signal: abort.signal,
            onDelta: (delta) =>
              emit({ ...base(threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta }),
          });
          appendNative(threadId, { dir: "in", source: "hf.chat.completions", msg: { text, usage } });
          if (text.trim()) {
            emit({ ...base(threadId, turnId), type: "item.completed", itemType: "assistant_text", text });
          }
          if (usage) {
            emit({ ...base(threadId, turnId), type: "thread.token-usage.updated", ...usage });
          }
          active.delete(threadId);
          emit({ ...base(threadId, turnId), type: "turn.completed", ok: true, stopReason: null, cost: null });
        } catch (e) {
          active.delete(threadId);
          const aborted = (e as Error).name === "AbortError";
          if (!aborted) {
            emit({ ...base(threadId, turnId), type: "runtime.error", message: (e as Error).message });
          }
          emit({
            ...base(threadId, turnId),
            type: "turn.completed",
            ok: false,
            stopReason: aborted ? "interrupted" : "error",
            cost: null,
          });
        }
      })();

      return { turnId };
    };

    const snapshot = async (): Promise<ProviderSnapshot> => {
      if (!apiKey) {
        return {
          state: "unavailable",
          reason: `no Hugging Face token — add {"hf":{"key":"hf_…"}} to ~/.config/workspacealberta/config.json or set HF_TOKEN`,
        };
      }
      return { state: "available", authenticated: true, version: null };
    };

    return {
      instanceId,
      driverKind: DRIVER_KIND,
      displayName: input.displayName,
      enabled: input.enabled,
      models: MODELS,
      snapshot,
      adapter: {
        provider: DRIVER_KIND,
        capabilities: { sessionModelSwitch: "in-session" },
        sendTurn,
        interruptTurn: async (threadId) => active.get(threadId)?.abort.abort(),
        respondToRequest: async () => {
          throw new Error("huggingface driver has no pending asks");
        },
        hasSession: (threadId) => active.has(threadId),
        stopAll: async () => {
          for (const { abort } of active.values()) abort.abort();
        },
        onEvent: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      generateText: async (prompt: string) => {
        // Use a smaller model for quick text generation tasks
        const { text } = await complete(
          [{ role: "user", content: prompt }],
          "meta-llama/Llama-3.1-8B-Instruct",
          { stream: false },
        );
        return text;
      },
      dispose: async () => {
        for (const { abort } of active.values()) abort.abort();
        listeners.clear();
      },
    };
  },
};
