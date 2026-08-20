#!/usr/bin/env node
// Smoke checks for start-helper env flags, the OpenAI/Composio tool loop,
// and the Grok model catalog default.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { electronArgs, electronEnv, serverLaunch, waitForHttp } from "./start-desktop.mjs";
import { accumulateToolCallDelta, normalizeToolCalls, runOpenAITurn } from "../server/drivers/openaiCompat.ts";
import { COMPOSIO_META_TOOLS, fallbackComposioOpenAITools } from "../server/composio.ts";
import { GrokDriver, GROK_DEFAULT_MODEL } from "../server/drivers/grok.ts";

const linuxEnv = electronEnv({ PATH: "/usr/bin" }, "linux");
assert.equal(linuxEnv.ELECTRON_DISABLE_SANDBOX, "1");
assert.equal(linuxEnv.ELECTRON_DISABLE_GPU, "1");
assert.deepEqual(electronArgs(linuxEnv, "linux"), [".", "--no-sandbox", "--disable-gpu"]);

const macEnv = electronEnv({ PATH: "/usr/bin" }, "darwin");
assert.equal(macEnv.ELECTRON_DISABLE_SANDBOX, undefined);
assert.deepEqual(electronArgs(macEnv, "darwin"), ["."]);

const launch22 = serverLaunch("22.14.0", "/tmp/does-not-exist.js");
assert.deepEqual(launch22.args, ["--experimental-strip-types", "server/index.ts"]);
const launch20 = serverLaunch("20.19.0", "/workspace/dist-server/index.js");
assert.ok(launch20.args[0].endsWith("dist-server/index.js"));

const names = fallbackComposioOpenAITools().map((t) => t.function.name);
for (const name of COMPOSIO_META_TOOLS) assert.ok(names.includes(name), name);

const acc = new Map();
accumulateToolCallDelta(acc, [
  { index: 0, id: "call_1", function: { name: "COMPOSIO_SEARCH_TOOLS", arguments: "{\"q" } },
  { index: 0, function: { arguments: "ueries\":[]}" } },
]);
assert.equal(acc.get(0)?.function.name, "COMPOSIO_SEARCH_TOOLS");
assert.equal(acc.get(0)?.function.arguments, '{"queries":[]}');
assert.equal(normalizeToolCalls([{ id: "x", function: { name: "T", arguments: "{}" } }])[0].function.name, "T");

const calls = [];
let hits = 0;
const server = createServer((req, res) => {
  hits += 1;
  let raw = "";
  req.on("data", (c) => {
    raw += c;
  });
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    res.setHeader("content-type", "application/json");
    if (hits === 1) {
      assert.ok(Array.isArray(body.tools) && body.tools.length >= 7, "first call must send Composio tools");
      assert.equal(body.tool_choice, "auto");
      const sys = body.messages.find((m) => m.role === "system")?.content ?? "";
      assert.match(sys, /Never claim you lack access/i);
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "call_search",
                    type: "function",
                    function: {
                      name: "COMPOSIO_SEARCH_TOOLS",
                      arguments: JSON.stringify({ queries: [{ use_case: "list Google Drive files" }] }),
                    },
                  },
                ],
              },
            },
          ],
        }),
      );
      return;
    }
    const toolMsg = body.messages.find((m) => m.role === "tool" && m.tool_call_id === "call_search");
    assert.ok(toolMsg, "second call must include the tool result");
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "Found 2 Drive files." } }] }));
  });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const events = [];
const { text } = await runOpenAITurn({
  url: `http://127.0.0.1:${port}/chat/completions`,
  apiKey: "test",
  model: "zai-org/GLM-4.6",
  messages: [{ role: "user", content: "List my Google Drive files" }],
  composio: { key: "ck_test" },
  errorPrefix: "test",
  listTools: async () => fallbackComposioOpenAITools(),
  executeTool: async (name, args) => {
    calls.push({ name, args });
    return { tools: [{ tool_slug: "GOOGLEDRIVE_LIST_FILES" }] };
  },
  onToolStart: (id, name) => events.push({ type: "start", id, name }),
  onToolDone: (id, ok) => events.push({ type: "done", id, ok }),
});
server.close();

assert.equal(text, "Found 2 Drive files.");
assert.equal(calls[0]?.name, "COMPOSIO_SEARCH_TOOLS");
assert.deepEqual(events, [
  { type: "start", id: "call_search", name: "COMPOSIO_SEARCH_TOOLS" },
  { type: "done", id: "call_search", ok: true },
]);

const waiter = createServer((_req, res) => {
  res.writeHead(200);
  res.end("ok");
});
await new Promise((resolve) => waiter.listen(0, "127.0.0.1", resolve));
const wport = waiter.address().port;
assert.equal(await waitForHttp(`http://127.0.0.1:${wport}/`, { timeoutMs: 2_000 }), true);
waiter.close();

assert.equal(GROK_DEFAULT_MODEL, "grok-4.6");
assert.equal(GrokDriver.models.default, "grok-4.6");
assert.ok(
  GrokDriver.models.options.some((option) => option.id === "grok-4.6"),
  "Grok picker must include grok-4.6",
);
const grokSrc = readFileSync(new URL("../server/drivers/grok.ts", import.meta.url), "utf8");
assert.match(grokSrc, /generateText:[\s\S]*GROK_DEFAULT_MODEL/);
assert.doesNotMatch(grokSrc, /generateText:[\s\S]*"grok-3-mini"/);

console.log("verify: start helper + Composio tool loop + Grok 4.6 catalog OK");
