#!/usr/bin/env node
// Setup-integrity checks for the workspaceAlbertaSetup repo. The chat app is
// gone; this verifies what remains: the installer, the industry skill pack,
// and the docs that reference them.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

// 1. Installer parses.
execFileSync("bash", ["-n", join(root, "installer/install-ceo-pi.sh")], { stdio: "pipe" });

// 2. No chat-app remnants are tracked.
for (const gone of ["src", "server", "electron", "dist-server", "index.html", "vite.config.ts"]) {
  assert.equal(existsSync(join(root, gone)), false, `chat-app remnant: ${gone}`);
}

// 3. The skill pack ships flat, one level deep, with SKILL.md frontmatter.
const skillsRoot = join(root, "skills");
const skills = readdirSync(skillsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
assert.ok(skills.length >= 7, `expected >= 7 skills, found ${skills.length}`);
for (const dir of skills) {
  const md = readFileSync(join(skillsRoot, dir.name, "SKILL.md"), "utf8");
  assert.ok(md.startsWith("---"), `${dir.name}/SKILL.md missing frontmatter`);
  assert.match(md, /^name:\s*\S+/m, `${dir.name}/SKILL.md missing name`);
  assert.match(md, /^description:/m, `${dir.name}/SKILL.md missing description`);
  // Nested dirs load nothing in the harness loader: guard the regression.
  assert.equal(existsSync(join(skillsRoot, dir.name, dir.name)), false, `${dir.name} nests itself`);
}

// 4. Docs the README points at exist.
for (const doc of ["docs/ceo-pi-setup.md", "docs/pi-out-of-box-setup.md"]) {
  assert.ok(existsSync(join(root, doc)), `missing ${doc}`);
}

const names = skills.map(s => s.name).sort();
console.log(`verify: installer syntax + ${names.length} flat skills (${names.join(", ")}) + docs OK`);
