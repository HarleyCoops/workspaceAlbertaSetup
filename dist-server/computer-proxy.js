// computer-proxy — a minimal MCP stdio server the claude CLI spawns
// (agentcal's permission-proxy pattern, dedicated entry file so there is
// no argv-dispatch fork-bomb hazard). It gives the agent shell access to
// the bot's e2b sandbox.
//
// Transport: every action goes through the e2b SDK's commands.run().
// e2b sandboxes are pure Linux VMs — no X11/desktop by default.
//
// stdout is the MCP channel — never console.log here.
import { Sandbox } from "e2b";
const sandboxId = process.env.OGB_SANDBOX_ID ?? "";
const apiKey = process.env.E2B_API_KEY ?? "";
let sandboxInstance = null;
async function getSandbox() {
    if (!sandboxInstance) {
        sandboxInstance = await Sandbox.connect(sandboxId, { apiKey });
    }
    return sandboxInstance;
}
async function runOnSandbox(command, timeoutMs = 60_000) {
    const sandbox = await getSandbox();
    const result = await sandbox.commands.run(command, { timeoutMs });
    return {
        ok: result.exitCode === 0,
        exitCode: result.exitCode ?? null,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}
async function readSandboxFile(path) {
    try {
        const sandbox = await getSandbox();
        const content = await sandbox.files.read(path);
        if (typeof content === "string") {
            return Buffer.from(content).toString("base64");
        }
        return Buffer.from(content).toString("base64");
    }
    catch {
        return null;
    }
}
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const text = (id, t, isError = false) => send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) } });
const TOOLS = [
    {
        name: "screenshot",
        description: "Attempt to capture the sandbox screen (returns an image if X11/display is available). e2b sandboxes are headless by default — this may fail.",
        inputSchema: { type: "object", properties: {} },
    },
    {
        name: "sandbox_exec",
        description: "Run a shell command on the bot's e2b sandbox (Linux, isolated environment). Returns stdout/stderr/exit code.",
        inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
    },
    {
        name: "write_file",
        description: "Write content to a file in the sandbox.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the file" },
                content: { type: "string", description: "Content to write" },
            },
            required: ["path", "content"],
        },
    },
    {
        name: "read_file",
        description: "Read content from a file in the sandbox.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the file" },
            },
            required: ["path"],
        },
    },
    {
        name: "list_files",
        description: "List files in a directory in the sandbox.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Absolute path to the directory" },
            },
            required: ["path"],
        },
    },
];
// Screenshot attempt for headless environments — unlikely to work without X11
const SHOT_CMD = [
    "export DISPLAY=${DISPLAY:-:0}",
    "f=/tmp/ogb-shot.png",
    'scrot -o "$f" 2>/dev/null || import -window root "$f" 2>/dev/null || { echo "no_display"; exit 0; }',
    'command -v convert >/dev/null && convert "$f" -resize 1280x "$f" 2>/dev/null || true',
    'test -s "$f" && echo captured || echo no_capture',
].join("; ");
async function call(id, name, args) {
    if (name === "screenshot") {
        const out = await runOnSandbox(SHOT_CMD, 60_000);
        if (out.stdout.includes("no_display")) {
            return text(id, "e2b sandboxes are headless by default — no display available for screenshot", true);
        }
        if (!out.stdout.includes("captured")) {
            return text(id, `screenshot failed: ${out.stderr.slice(0, 200) || "capture produced no file"}`, true);
        }
        const data = await readSandboxFile("/tmp/ogb-shot.png");
        if (!data)
            return text(id, "screenshot failed: could not read the frame back", true);
        return send({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "image", data, mimeType: "image/png" }] },
        });
    }
    if (name === "sandbox_exec") {
        const out = await runOnSandbox(String(args.command ?? "").slice(0, 4000), 120_000);
        return text(id, `exit ${out.exitCode}\n${out.stdout.slice(-6000)}${out.stderr ? `\n[stderr]\n${out.stderr.slice(-2000)}` : ""}`);
    }
    if (name === "write_file") {
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        if (!path)
            return text(id, "path required", true);
        try {
            const sandbox = await getSandbox();
            await sandbox.files.write(path, content);
            return text(id, `wrote ${content.length} bytes to ${path}`);
        }
        catch (e) {
            return text(id, `write failed: ${e.message}`, true);
        }
    }
    if (name === "read_file") {
        const path = String(args.path ?? "");
        if (!path)
            return text(id, "path required", true);
        try {
            const sandbox = await getSandbox();
            const content = await sandbox.files.read(path);
            const str = typeof content === "string" ? content : new TextDecoder().decode(content);
            return text(id, str.slice(0, 10000));
        }
        catch (e) {
            return text(id, `read failed: ${e.message}`, true);
        }
    }
    if (name === "list_files") {
        const path = String(args.path ?? "/");
        try {
            const sandbox = await getSandbox();
            const files = await sandbox.files.list(path);
            const listing = files.map((f) => `${f.type === "dir" ? "d" : "-"} ${f.name}`).join("\n");
            return text(id, listing || "(empty directory)");
        }
        catch (e) {
            return text(id, `list failed: ${e.message}`, true);
        }
    }
    return text(id, `unknown tool ${name}`, true);
}
async function handle(msg) {
    if (msg.method === "initialize") {
        return send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
                protocolVersion: msg.params?.protocolVersion ?? "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: "workspacealberta-sandbox", version: "2" },
            },
        });
    }
    if (msg.method === "tools/list")
        return send({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
    if (msg.method === "tools/call") {
        try {
            return await call(msg.id, msg.params?.name, msg.params?.arguments ?? {});
        }
        catch (e) {
            return text(msg.id, `sandbox tool failed: ${e.message}`, true);
        }
    }
    if (String(msg.method ?? "").startsWith("notifications/"))
        return;
    if (msg.id != null) {
        send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `method not found: ${msg.method}` } });
    }
}
let buf = "";
process.stdin.on("data", (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim())
            continue;
        try {
            void handle(JSON.parse(line));
        }
        catch {
            /* ignore malformed lines */
        }
    }
});
process.stdin.on("end", () => process.exit(0));
