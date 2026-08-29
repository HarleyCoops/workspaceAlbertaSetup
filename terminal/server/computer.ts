import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const STARTER_README = `WorkspaceAlberta Terminal — local computer
This folder is the harness workspace for this subscriber desk.
Agents read and write here only after you approve destructive or external work.
`;

export class LocalComputer {
  constructor(readonly cwd: string) {
    mkdirSync(cwd, { recursive: true });
    const readme = join(cwd, "README.txt");
    try {
      statSync(readme);
    } catch {
      writeFileSync(readme, STARTER_README, "utf8");
    }
  }

  list(): string[] {
    return walk(this.cwd, this.cwd).sort();
  }

  read(relPath: string): string {
    const abs = this.resolveInside(relPath);
    return readFileSync(abs, "utf8");
  }

  write(relPath: string, contents: string): void {
    const abs = this.resolveInside(relPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents, "utf8");
  }

  async exec(command: string, timeoutMs = 20_000): Promise<{ output: string; exit: number }> {
    const tokens = tokenize(command);
    if (!tokens.length) throw new Error("empty command");
    const [bin, ...args] = tokens;
    return new Promise((resolvePromise, reject) => {
      const child = spawn(bin, args, {
        cwd: this.cwd,
        env: { ...process.env, HOME: this.cwd, PWD: this.cwd },
        shell: false,
      });
      let output = "";
      const append = (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (output.length > 64_000) output = `${output.slice(0, 64_000)}\n…truncated`;
      };
      child.stdout.on("data", append);
      child.stderr.on("data", append);
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolvePromise({ output: output || "(no output)", exit: code ?? 1 });
      });
    });
  }

  resolveInside(relPath: string): string {
    const cleaned = relPath.replace(/^[/\\]+/, "");
    const abs = resolve(this.cwd, cleaned);
    const rel = relative(this.cwd, abs);
    if (rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
      throw new Error("path escapes the computer workspace");
    }
    return abs;
  }
}

function walk(root: string, dir: string, depth = 0): string[] {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".")) continue;
    const abs = join(dir, name);
    const rel = relative(root, abs) || name;
    const st = statSync(abs);
    if (st.isDirectory()) {
      out.push(`${rel}/`);
      out.push(...walk(root, abs, depth + 1));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (const ch of command.trim()) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}
