/**
 * Hermetic sandbox for eval runs: a throwaway git repo containing ONLY the
 * capability layer (CLAUDE.md, .claude/, schema/, tools/, package files).
 * The corpus and goldens are never copied in — drop text arrives via the
 * prompt, so the agent physically cannot peek at expected answers.
 *
 * Caching: after each drop the sandbox state is tarred to eval/.cache keyed by
 * (skillhash, seq), so `--drops 7` can resume from after-06 without re-running
 * 1..6. A skillhash change invalidates the cache (override with --stale-ok).
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const CAPABILITY = ["CLAUDE.md", ".claude", "schema", "tools", "package.json", "tsconfig.json"];

export function skillhash(repoDir: string): string {
  const h = createHash("sha256");
  for (const f of [
    ".claude/skills/brain-ingest/SKILL.md",
    ".claude/skills/brain-init/SKILL.md",
    "schema/SCHEMA.md",
    "schema/FINDINGS.md",
  ]) {
    h.update(readFileSync(path.join(repoDir, f)));
  }
  return h.digest("hex").slice(0, 12);
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

export function createSandbox(repoDir: string, runId: string): string {
  const dir = path.join(repoDir, "eval", ".sandbox", runId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const item of CAPABILITY) {
    cpSync(path.join(repoDir, item), path.join(dir, item), { recursive: true });
  }
  // Fixtures are unit-test baggage the agent doesn't need.
  rmSync(path.join(dir, "tools", "__fixtures__"), { recursive: true, force: true });
  rmSync(path.join(dir, "tools", "parser.test.ts"), { force: true });
  rmSync(path.join(dir, "tools", "validate.test.ts"), { force: true });
  rmSync(path.join(dir, "tools", "trailers.test.ts"), { force: true });
  mkdirSync(path.join(dir, "clients"));
  symlinkSync(path.join(repoDir, "node_modules"), path.join(dir, "node_modules"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "eval@client-brain.local");
  git(dir, "config", "user.name", "Client Brain Eval");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "sandbox base");
  return dir;
}

export function tagAfterDrop(sandboxDir: string, seq: number): string {
  const tag = `eval/after-${String(seq).padStart(2, "0")}`;
  git(sandboxDir, "tag", "-f", tag);
  return tag;
}

function cachePath(repoDir: string, hash: string, seq: number): string {
  return path.join(repoDir, "eval", ".cache", `${hash}-after-${String(seq).padStart(2, "0")}.tar`);
}

export function snapshot(repoDir: string, sandboxDir: string, hash: string, seq: number): void {
  const out = cachePath(repoDir, hash, seq);
  mkdirSync(path.dirname(out), { recursive: true });
  // Exclude the node_modules symlink; everything else (incl. .git) goes in.
  execFileSync("tar", ["-cf", out, "--exclude=node_modules", "-C", sandboxDir, "."]);
}

export function restoreSnapshot(
  repoDir: string,
  hash: string,
  seq: number,
  runId: string,
  staleOk: boolean,
): string | null {
  let p = cachePath(repoDir, hash, seq);
  if (!existsSync(p)) {
    if (!staleOk) return null;
    // --stale-ok: accept a snapshot from any skillhash (newest wins).
    const dir = path.join(repoDir, "eval", ".cache");
    if (!existsSync(dir)) return null;
    const suffix = `-after-${String(seq).padStart(2, "0")}.tar`;
    const candidates = execFileSync("ls", ["-t", dir], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith(suffix));
    if (!candidates.length) return null;
    p = path.join(dir, candidates[0]!);
  }
  const dir = path.join(repoDir, "eval", ".sandbox", runId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  execFileSync("tar", ["-xf", p, "-C", dir]);
  symlinkSync(path.join(repoDir, "node_modules"), path.join(dir, "node_modules"));
  return dir;
}

export function removeSandbox(sandboxDir: string): void {
  rmSync(sandboxDir, { recursive: true, force: true });
}
