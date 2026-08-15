// DeepSeek driver — official paid API (OpenAI-compatible chat/completions
// with SSE streaming). Same transcript-replay shape as grok.ts / huggingface.ts.
// Official model ids (2026): deepseek-v4-pro (flagship) and deepseek-v4-flash.
// There is no "deepseek-pro" or "deepseek-chat" slug on the current API.
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
import { openaiComplete, runOpenAITurn, type ChatMessage } from "./openaiCompat.ts";

const DRIVER_KIND = "deepseek";
const DEFAULT_URL = "https://api.deepseek.com";

const MODELS = {
  default: "deepseek-v4-pro",
  options: [
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  ],
};

export interface DeepSeekConfig {
  url: string;
  /** resolved at create-time from instance environment / app config */
  apiKeyEnv: string;
}

function decodeConfig(raw: unknown): DeepSeekConfig {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    url: typeof o.url === "string" ? o.url : DEFAULT_URL,
    apiKeyEnv: typeof o.apiKeyEnv === "string" ? o.apiKeyEnv : "DEEPSEEK_API_KEY",
  };
}

export const DeepSeekDriver: ProviderDriver<DeepSeekConfig> = {
  driverKind: DRIVER_KIND,
  metadata: { displayName: "DeepSeek", supportsMultipleInstances: true },
  models: MODELS,
  decodeConfig,
  defaultConfig: () => decodeConfig({}),

  async create(input: DriverCreateInput<DeepSeekConfig>): Promise<ProviderInstance> {
    const { instanceId, config } = input;
    const apiKey =
      input.environment[config.apiKeyEnv] ??
      process.env[config.apiKeyEnv] ??
      input.environment.DEEPSEEK_API_KEY ??
      process.env.DEEPSEEK_API_KEY ??
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

    const sendTurn = async (turn: SendTurnInput) => {
      const { threadId } = turn;
      if (!apiKey) throw new Error(`no DeepSeek key — set ${config.apiKeyEnv} or config.json deepseek.key`);
      if (active.has(threadId)) throw new Error("a turn is already running on this thread");
      const turnId = newId();
      const abort = new AbortController();
      active.set(threadId, { abort, turnId });

      const messages: ChatMessage[] = [
        ...(turn.system ? [{ role: "system" as const, content: turn.system }] : []),
        ...(turn.transcript ?? []).map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: m.text,
        })),
        { role: "user", content: turn.text },
      ];
      appendNative(threadId, {
        dir: "out",
        source: "deepseek.chat.completions",
        msg: { model: turn.model, messages, composio: Boolean(turn.integrations?.composio?.key) },
      });

      emit({ ...base(threadId, turnId), type: "turn.started" });
      emit({ ...base(threadId, turnId), type: "session.started", sessionId: null, model: turn.model ?? MODELS.default });

      (async () => {
        try {
          const { text, usage } = await runOpenAITurn({
            url: `${config.url}/chat/completions`,
            apiKey,
            model: turn.model || MODELS.default,
            messages,
            composio: turn.integrations?.composio,
            signal: abort.signal,
            onDelta: (delta) =>
              emit({ ...base(threadId, turnId), type: "content.delta", streamKind: "assistant_text", delta }),
            onToolStart: (id, name) =>
              emit({ ...base(threadId, turnId), type: "item.started", itemType: "tool", itemId: id, title: name }),
            onToolDone: (id, ok) =>
              emit({ ...base(threadId, turnId), type: "item.completed", itemType: "tool", itemId: id, ok }),
            errorPrefix: "DeepSeek",
          });
          appendNative(threadId, { dir: "in", source: "deepseek.chat.completions", msg: { text, usage } });
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
          reason: `no DeepSeek API key — add {"deepseek":{"key":"sk-…"}} to config.json or set ${config.apiKeyEnv}`,
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
          throw new Error("deepseek driver has no pending asks");
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
        const { text } = await openaiComplete({
          url: `${config.url}/chat/completions`,
          apiKey,
          model: "deepseek-v4-flash",
          messages: [{ role: "user", content: prompt }],
          stream: false,
          errorPrefix: "DeepSeek",
        });
        return text;
      },
      dispose: async () => {
        for (const { abort } of active.values()) abort.abort();
        listeners.clear();
      },
    };
  },
};
