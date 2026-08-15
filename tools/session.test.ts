/**
 * Sessions exist to stop concurrent writers corrupting each other's findings.
 * So the first thing this file does is REPRODUCE the corruption in a shared
 * checkout — otherwise the tests that follow prove nothing.
 */

import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const git = (cwd: string, ...a: string[]): string =>
  execFileSync("git", a, { cwd, encoding: "utf8" }).trim();

/** A throwaway repo carrying just enough of the capability layer to commit. */
function scratchRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "brain-session-"));
  mkdirSync(path.join(dir, "tools"), { recursive: true });
  mkdirSync(path.join(dir, "clients", "acme"), { recursive: true });
  mkdirSync(path.join(dir, "clients", "beta"), { recursive: true });
  writeFileSync(
    path.join(dir, "tools", "commit-finding.sh"),
    readFileSync(path.join(REPO, "tools", "commit-finding.sh")),
    { mode: 0o755 },
  );
  writeFileSync(path.join(dir, "clients", "acme", "decisions.md"), "# Decisions\n");
  writeFileSync(path.join(dir, "clients", "beta", "decisions.md"), "# Decisions\n");
  // Mirrors the real repo: a node_modules to symlink into sessions, and the
  // ignore rule WITHOUT a trailing slash. `node_modules/` matches directories
  // only, and git sees the symlink as a file — so the slash version leaves
  // every session permanently dirty and unclosable.
  mkdirSync(path.join(dir, "node_modules"));
  writeFileSync(path.join(dir, "node_modules", ".keep"), "");
  writeFileSync(path.join(dir, ".gitignore"), "node_modules\n.sessions/\n");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "test@brain.local");
  git(dir, "config", "user.name", "Test");
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  return dir;
}

const commitFinding = (cwd: string, client: string, file: string): string =>
  execFileSync(
    "bash",
    [
      path.join(cwd, "tools", "commit-finding.sh"),
      "-c", client, "-t", "decision-new", "-e", `dec-${client}`,
      "-s", `drop-2024-01-01-${client}`, "-m", `record a ${client} decision`, file,
    ],
    { cwd, encoding: "utf8" },
  );

const session = (cwd: string, ...a: string[]): string =>
  execFileSync("npx", ["tsx", path.join(REPO, "tools", "session.ts"), ...a], {
    cwd,
    encoding: "utf8",
  });

const scratches: string[] = [];
const fresh = (): string => {
  const d = scratchRepo();
  scratches.push(d);
  return d;
};
afterAll(() => {
  for (const d of scratches) rmSync(d, { recursive: true, force: true });
});

describe("the corruption sessions prevent", () => {
  it("a shared checkout lets one client's staged work break the other's commit", () => {
    const repo = fresh();
    // Session A edits and stages acme, then pauses (an agent thinking).
    writeFileSync(path.join(repo, "clients", "acme", "decisions.md"), "# Decisions\n\n## A\n");
    git(repo, "add", "clients/acme/decisions.md");

    // Session B tries to commit an unrelated beta finding through the gate.
    writeFileSync(path.join(repo, "clients", "beta", "decisions.md"), "# Decisions\n\n## B\n");
    expect(() => commitFinding(repo, "beta", "clients/beta/decisions.md")).toThrow(
      /index is not clean/,
    );
  });
});

describe("session open", () => {
  const repo = fresh();
  const opened = JSON.parse(session(repo, "open", "acme", "--json")) as {
    id: string;
    client: string;
    branch: string;
    dir: string;
  };

  it("creates a worktree on its own branch", () => {
    expect(opened.client).toBe("acme");
    expect(opened.branch).toBe(`session/${opened.id}`);
    expect(existsSync(path.join(opened.dir, "clients", "acme"))).toBe(true);
    expect(git(opened.dir, "rev-parse", "--abbrev-ref", "HEAD")).toBe(opened.branch);
  });

  it("recovers the client from the id even though slugs contain hyphens", () => {
    const hyphenated = JSON.parse(session(repo, "open", "acme", "--label", "x", "--json")) as {
      client: string;
      id: string;
    };
    expect(hyphenated.client).toBe("acme");
    session(repo, "abort", hyphenated.id);
  });

  it("symlinks node_modules without leaving the session dirty", () => {
    // Both halves matter: the symlink must exist (or `npx tsx` refetches
    // everything in the worktree), and it must be ignored (or every close
    // refuses, believing there is uncommitted work to protect).
    expect(existsSync(path.join(opened.dir, "node_modules"))).toBe(true);
    expect(git(opened.dir, "status", "--porcelain")).toBe("");
  });

  it("lists what is open", () => {
    const rows = JSON.parse(session(repo, "list", "--json")) as { id: string; findings: number }[];
    expect(rows.map((r) => r.id)).toContain(opened.id);
    expect(rows.find((r) => r.id === opened.id)!.findings).toBe(0);
  });
});

describe("concurrent sessions on different clients", () => {
  const repo = fresh();
  const a = JSON.parse(session(repo, "open", "acme", "--json")) as { id: string; dir: string };
  const b = JSON.parse(session(repo, "open", "beta", "--json")) as { id: string; dir: string };

  it("both commit through the gate without colliding", () => {
    // Interleaved deliberately: A stages and commits while B has work in
    // flight. In one checkout this is the failure reproduced above.
    writeFileSync(path.join(a.dir, "clients", "acme", "decisions.md"), "# Decisions\n\n## A\n");
    writeFileSync(path.join(b.dir, "clients", "beta", "decisions.md"), "# Decisions\n\n## B\n");
    git(a.dir, "add", "clients/acme/decisions.md");
    git(a.dir, "reset", "--quiet"); // A unstages; B must be unaffected either way

    expect(() => commitFinding(a.dir, "acme", "clients/acme/decisions.md")).not.toThrow();
    expect(() => commitFinding(b.dir, "beta", "clients/beta/decisions.md")).not.toThrow();
  });

  it("keeps each finding attributed to the right client", () => {
    // The real damage from a shared index is a commit carrying another
    // client's files, which would silently corrupt the ledger.
    const filesA = git(a.dir, "show", "--name-only", "--format=", "HEAD");
    expect(filesA).toContain("clients/acme/decisions.md");
    expect(filesA).not.toContain("beta");
    expect(git(a.dir, "log", "-1", "--format=%s")).toContain("decision-new(acme)");
    expect(git(b.dir, "log", "-1", "--format=%s")).toContain("decision-new(beta)");
  });

  it("merges both sessions into main, rewriting no finding commit", () => {
    const shaA = git(a.dir, "rev-parse", "HEAD");
    const shaB = git(b.dir, "rev-parse", "HEAD");
    session(repo, "close", a.id);
    session(repo, "close", b.id);

    // Same SHAs after integration — a rebase would have changed them, and
    // schema/FINDINGS.md forbids rewriting brain history.
    expect(git(repo, "cat-file", "-t", shaA)).toBe("commit");
    expect(git(repo, "merge-base", "--is-ancestor", shaA, "main")).toBe("");
    expect(git(repo, "merge-base", "--is-ancestor", shaB, "main")).toBe("");
    expect(session(repo, "list")).toContain("no open sessions");
  });

  it("leaves both findings readable by query-log's git log walk", () => {
    // No --first-parent anywhere in readFindingCommits, so merged sessions
    // must both show up.
    const subjects = git(repo, "log", "--format=%s");
    expect(subjects).toContain("decision-new(acme)");
    expect(subjects).toContain("decision-new(beta)");
  });
});

describe("close refuses to destroy work", () => {
  const repo = fresh();

  it("stops when the session has uncommitted changes", () => {
    const s = JSON.parse(session(repo, "open", "acme", "--json")) as { id: string; dir: string };
    writeFileSync(path.join(s.dir, "clients", "acme", "decisions.md"), "# Decisions\n\n## draft\n");
    expect(() => session(repo, "close", s.id)).toThrow(/uncommitted changes/);
    // …and the session survives the refusal.
    expect(session(repo, "list")).toContain(s.id);
    session(repo, "abort", s.id, "--force");
  });

  it("stops an abort that would discard committed findings, unless forced", () => {
    const s = JSON.parse(session(repo, "open", "beta", "--json")) as { id: string; dir: string };
    writeFileSync(path.join(s.dir, "clients", "beta", "decisions.md"), "# Decisions\n\n## B\n");
    commitFinding(s.dir, "beta", "clients/beta/decisions.md");
    expect(() => session(repo, "abort", s.id)).toThrow(/would be destroyed/);
    expect(session(repo, "abort", s.id, "--force")).toContain("1 finding(s) discarded");
  });

  it("cleans up a session that recorded nothing", () => {
    const s = JSON.parse(session(repo, "open", "acme", "--json")) as { id: string };
    expect(session(repo, "close", s.id)).toContain("no findings recorded");
    expect(session(repo, "list")).toContain("no open sessions");
  });
});
