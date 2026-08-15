// Shared OpenAI-compatible chat/completions helper + Composio tool loop.
// Used by optional Hugging Face / DeepSeek chat APIs. Upstream tool mesh
// is still Claude/Codex MCP; this loop is a best-effort extra on raw
// OpenAI-compatible completions.
import { COMPOSIO_SYSTEM_HINT, composioCall, composioOpenAITools, } from "../composio.js";
const MAX_TOOL_ITERS = 8;
export function accumulateToolCallDelta(acc, deltas) {
    for (const tc of deltas) {
        const idx = tc.index ?? 0;
        const cur = acc.get(idx) ?? { id: "", type: "function", function: { name: "", arguments: "" } };
        if (tc.id)
            cur.id = tc.id;
        if (tc.function?.name)
            cur.function.name += tc.function.name;
        if (tc.function?.arguments)
            cur.function.arguments += tc.function.arguments;
        acc.set(idx, cur);
    }
}
export function normalizeToolCalls(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((tc, i) => {
        const id = typeof tc?.id === "string" && tc.id ? tc.id : `call_${i}`;
        const name = tc?.function?.name ?? tc?.name ?? "";
        const args = typeof tc?.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc?.function?.arguments ?? tc?.arguments ?? {});
        return { id, type: "function", function: { name, arguments: args } };
    })
        .filter((tc) => tc.function.name);
}
export async function openaiComplete(opts) {
    const body = {
        model: opts.model,
        messages: opts.messages,
        stream: opts.stream,
        ...opts.extraBody,
    };
    if (opts.tools?.length) {
        body.tools = opts.tools;
        body.tool_choice = "auto";
    }
    const res = await fetch(opts.url, {
        method: "POST",
        headers: {
            authorization: `Bearer ${opts.apiKey}`,
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: opts.signal ?? AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        throw new Error(`${opts.errorPrefix} HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 200)}` : ""}`);
    }
    if (!opts.stream) {
        const json = await res.json();
        const msg = json.choices?.[0]?.message ?? {};
        return {
            text: typeof msg.content === "string" ? msg.content : "",
            toolCalls: normalizeToolCalls(msg.tool_calls),
            usage: json.usage
                ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
                : null,
        };
    }
    let text = "";
    let usage = null;
    const toolAcc = new Map();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:"))
                continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]")
                continue;
            let chunk;
            try {
                chunk = JSON.parse(data);
            }
            catch {
                continue;
            }
            const delta = chunk.choices?.[0]?.delta;
            const piece = delta?.content;
            if (piece) {
                text += piece;
                opts.onDelta?.(piece);
            }
            if (Array.isArray(delta?.tool_calls))
                accumulateToolCallDelta(toolAcc, delta.tool_calls);
            if (chunk.choices?.[0]?.message?.tool_calls) {
                for (const [i, tc] of normalizeToolCalls(chunk.choices[0].message.tool_calls).entries()) {
                    toolAcc.set(i, tc);
                }
            }
            if (chunk.usage) {
                usage = { input: chunk.usage.prompt_tokens ?? 0, output: chunk.usage.completion_tokens ?? 0 };
            }
        }
    }
    return { text, toolCalls: [...toolAcc.values()].filter((tc) => tc.function.name), usage };
}
export async function runOpenAITurn(opts) {
    const messages = opts.messages.map((m) => ({ ...m }));
    const tools = opts.composio
        ? await (opts.listTools ?? composioOpenAITools)(opts.composio)
        : undefined;
    if (opts.composio) {
        const hint = COMPOSIO_SYSTEM_HINT;
        const sys = messages.find((m) => m.role === "system");
        if (sys)
            sys.content = `${sys.content ?? ""}\n\n${hint}`.trim();
        else
            messages.unshift({ role: "system", content: hint });
    }
    const execute = opts.executeTool ??
        (async (name, args) => {
            if (!opts.composio)
                throw new Error("no Composio auth");
            return composioCall(opts.composio, name, args);
        });
    const maxIters = opts.maxIters ?? MAX_TOOL_ITERS;
    let usage = null;
    let lastText = "";
    for (let i = 0; i < maxIters; i++) {
        const useTools = Boolean(tools?.length);
        const result = await openaiComplete({
            url: opts.url,
            apiKey: opts.apiKey,
            model: opts.model,
            messages,
            tools: useTools ? tools : undefined,
            stream: !useTools,
            signal: opts.signal,
            onDelta: useTools ? undefined : opts.onDelta,
            errorPrefix: opts.errorPrefix,
            extraBody: opts.extraBody,
        });
        if (result.usage) {
            usage = usage
                ? { input: usage.input + result.usage.input, output: usage.output + result.usage.output }
                : result.usage;
        }
        lastText = result.text;
        if (!result.toolCalls.length) {
            if (useTools && result.text)
                opts.onDelta?.(result.text);
            return { text: result.text, usage };
        }
        messages.push({
            role: "assistant",
            content: result.text || null,
            tool_calls: result.toolCalls,
        });
        for (const call of result.toolCalls) {
            opts.onToolStart?.(call.id, call.function.name);
            let args = {};
            try {
                args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
            }
            catch {
                args = {};
            }
            let payload;
            let ok = true;
            try {
                const out = await execute(call.function.name, args);
                payload = typeof out === "string" ? out : JSON.stringify(out ?? {});
            }
            catch (e) {
                ok = false;
                payload = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
            }
            opts.onToolDone?.(call.id, ok);
            messages.push({ role: "tool", tool_call_id: call.id, content: payload });
        }
    }
    throw new Error(`${opts.errorPrefix}: tool loop exceeded ${maxIters} iterations${lastText ? ` (last text: ${lastText.slice(0, 80)})` : ""}`);
}
