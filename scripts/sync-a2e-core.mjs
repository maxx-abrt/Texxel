#!/usr/bin/env node
/**
 * sync-a2e-core.mjs — refresh the vendored `@a2e/core` package (packages/a2e-core)
 * from the upstream A2E-Core repo.
 *
 * Usage:
 *   A2E_CORE_PATH="../A2E Core" node scripts/sync-a2e-core.mjs          # local checkout
 *   GITHUB_TOKEN=ghp_xxx      node scripts/sync-a2e-core.mjs --ref v0.3.0 # clone from GitHub
 *   node scripts/sync-a2e-core.mjs --ref main --repo maxx-abrt/A2E-Core
 *
 * What it does: copies `packages/core/{src,CHANGELOG.md}` over the vendored copy,
 * stamps `a2e.upstreamVersion` / `a2e.upstreamCommit` in packages/a2e-core/package.json,
 * and prints a summary. It never touches core's Convex functions (they stay remote).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const vendorDir = path.join(repoRoot, "packages", "a2e-core");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const ref = flag("ref", "main");
const repo = flag("repo", "maxx-abrt/A2E-Core");
const localPath = process.env.A2E_CORE_PATH ? path.resolve(repoRoot, process.env.A2E_CORE_PATH) : null;

const sh = (cmd, cmdArgs, cwd) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

let sourceRoot;
let tmp;
if (localPath) {
  if (!existsSync(path.join(localPath, "packages", "core", "src"))) {
    console.error(`✖ A2E_CORE_PATH does not look like the A2E-Core repo: ${localPath}`);
    process.exit(1);
  }
  sourceRoot = localPath;
  console.log(`→ source: local checkout ${localPath}`);
} else {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error("✖ Set A2E_CORE_PATH (local checkout) or GITHUB_TOKEN (clone from GitHub).");
    process.exit(1);
  }
  tmp = mkdtempSync(path.join(tmpdir(), "a2e-core-"));
  sourceRoot = path.join(tmp, "repo");
  console.log(`→ source: github.com/${repo}@${ref}`);
  sh("git", ["clone", "--depth", "1", "--branch", ref, `https://${token}@github.com/${repo}.git`, sourceRoot]);
}

const srcPkgPath = path.join(sourceRoot, "packages", "core", "package.json");
const srcPkg = JSON.parse(readFileSync(srcPkgPath, "utf8"));
let commit = "unknown";
try {
  commit = sh("git", ["rev-parse", "HEAD"], sourceRoot);
} catch {
  /* not a git checkout — keep "unknown" */
}

// 1. source + changelog
rmSync(path.join(vendorDir, "src"), { recursive: true, force: true });
cpSync(path.join(sourceRoot, "packages", "core", "src"), path.join(vendorDir, "src"), { recursive: true });
const changelog = path.join(sourceRoot, "packages", "core", "CHANGELOG.md");
if (existsSync(changelog)) cpSync(changelog, path.join(vendorDir, "CHANGELOG.md"));

// 2. stamp provenance (local package.json/tsconfig stay ours — workspace wiring)
const vendorPkgPath = path.join(vendorDir, "package.json");
const vendorPkg = JSON.parse(readFileSync(vendorPkgPath, "utf8"));
vendorPkg.version = srcPkg.version;
vendorPkg.a2e = {
  ...(vendorPkg.a2e ?? {}),
  upstreamRepo: localPath ? (vendorPkg.a2e?.upstreamRepo ?? `https://github.com/${repo}`) : `https://github.com/${repo}`,
  upstreamPath: "packages/core",
  upstreamVersion: srcPkg.version,
  upstreamCommit: commit,
  syncedAt: new Date().toISOString(),
};
writeFileSync(vendorPkgPath, `${JSON.stringify(vendorPkg, null, 2)}\n`);

if (tmp) rmSync(tmp, { recursive: true, force: true });

console.log(`✓ vendored @a2e/core@${srcPkg.version} (${commit.slice(0, 8)}) into packages/a2e-core`);
console.log("  next: read packages/a2e-core/CHANGELOG.md → pnpm typecheck → commit");
