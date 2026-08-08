import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatCommitMessage, readFindingCommits, FINDING_TYPES } from "./lib/trailers.js";

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GATE = path.join(REPO_ROOT, "tools", "commit-finding.sh");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function initRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "brain-test-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "test@test.local");
  git(dir, "config", "user.name", "Test");
  writeFileSync(path.join(dir, "base.txt"), "base\n");
  git(dir, "add", "base.txt");
  git(dir, "commit", "-qm", "base");
  return dir;
}

describe("formatCommitMessage", () => {
  it("produces the FINDINGS.md format", () => {
    const msg = formatCommitMessage({
      findingType: "decision-superseded",
      client: "testco",
      summary: "move to phased rollout",
      project: "proj-widget",
      entity: "dec-20240301-phased-rollout",
      refs: ["dec-20240105-big-bang"],
      attributedTo: "sh-bo-reyes",
      source: "drop-2024-03-01-review",
    });
    expect(msg).toBe(
      [
        "decision-superseded(testco): move to phased rollout",
        "",
        "Client: testco",
        "Project: proj-widget",
        "Finding: decision-superseded",
        "Entity: dec-20240301-phased-rollout",
        "Refs: dec-20240105-big-bang",
        "Attributed-To: sh-bo-reyes",
        "Source: drop-2024-03-01-review",
      ].join("\n"),
    );
  });
});

describe("readFindingCommits round-trip", () => {
  let repo: string;

  beforeAll(() => {
    repo = initRepo();
    writeFileSync(path.join(repo, "a.md"), "a\n");
    git(repo, "add", "a.md");
    git(
      repo,
      "commit",
      "-qm",
      formatCommitMessage({
        findingType: "stakeholder-new",
        client: "testco",
        summary: "Ada Vance (CTO) identified",
        entity: "sh-ada-vance",
        source: "drop-2024-01-05-kickoff",
      }),
    );
  });

  it("parses trailers back out, newest first", () => {
    const commits = readFindingCommits(repo);
    expect(commits.length).toBe(2);
    const c = commits[0]!;
    expect(c.subject).toBe("stakeholder-new(testco): Ada Vance (CTO) identified");
    expect(c.client).toBe("testco");
    expect(c.finding).toBe("stakeholder-new");
    expect(c.entity).toBe("sh-ada-vance");
    expect(c.source).toBe("drop-2024-01-05-kickoff");
    expect(commits[1]!.finding).toBeUndefined(); // base commit has no trailers
  });

  it("reads touched files when asked", () => {
    const commits = readFindingCommits(repo, { withFiles: true });
    expect(commits[0]!.files).toEqual(["a.md"]);
  });
});

describe("commit-finding.sh gate", () => {
  it("commits named files with full trailers", () => {
    const repo = initRepo();
    writeFileSync(path.join(repo, "stakeholders.md"), "content\n");
    const out = execFileSync(
      "bash",
      [
        GATE,
        "-c", "testco",
        "-t", "stakeholder-new",
        "-e", "sh-ada-vance",
        "-s", "drop-2024-01-05-kickoff",
        "-a", "sh-ada-vance",
        "-m", "Ada Vance (CTO) identified",
        "stakeholders.md",
      ],
      { cwd: repo, encoding: "utf8" },
    );
    expect(out).toContain("stakeholder-new(testco)");
    const commits = readFindingCommits(repo, { withFiles: true });
    expect(commits[0]!.entity).toBe("sh-ada-vance");
    expect(commits[0]!.attributedTo).toBe("sh-ada-vance");
    expect(commits[0]!.files).toEqual(["stakeholders.md"]);
  });

  it("rejects unknown finding types", () => {
    const repo = initRepo();
    writeFileSync(path.join(repo, "x.md"), "x\n");
    expect(() =>
      execFileSync(
        "bash",
        [GATE, "-c", "t", "-t", "not-a-type", "-e", "e", "-s", "s", "-m", "m", "x.md"],
        { cwd: repo, encoding: "utf8", stdio: "pipe" },
      ),
    ).toThrow(/unknown finding type/);
  });

  it("refuses when other changes are already staged", () => {
    const repo = initRepo();
    writeFileSync(path.join(repo, "sneaky.md"), "sneak\n");
    git(repo, "add", "sneaky.md");
    writeFileSync(path.join(repo, "x.md"), "x\n");
    expect(() =>
      execFileSync(
        "bash",
        [GATE, "-c", "t", "-t", "drop", "-e", "drop-2024-01-01-x", "-s", "drop-2024-01-01-x", "-m", "m", "x.md"],
        { cwd: repo, encoding: "utf8", stdio: "pipe" },
      ),
    ).toThrow(/index is not clean/);
  });

  it("refuses no-op commits and over-long summaries", () => {
    const repo = initRepo();
    expect(() =>
      execFileSync(
        "bash",
        [GATE, "-c", "t", "-t", "drop", "-e", "d", "-s", "d", "-m", "m", "base.txt"],
        { cwd: repo, encoding: "utf8", stdio: "pipe" },
      ),
    ).toThrow(/no changes to commit/);

    writeFileSync(path.join(repo, "y.md"), "y\n");
    const long = "x".repeat(73);
    expect(() =>
      execFileSync(
        "bash",
        [GATE, "-c", "t", "-t", "drop", "-e", "d", "-s", "d", "-m", long, "y.md"],
        { cwd: repo, encoding: "utf8", stdio: "pipe" },
      ),
    ).toThrow(/summary exceeds 72/);
  });

  it("stamps and reads back the Backfill trailer via -B", () => {
    const repo = initRepo();
    writeFileSync(path.join(repo, "decisions.md"), "old decision\n");
    execFileSync(
      "bash",
      [
        GATE,
        "-c", "testco",
        "-t", "decision-new",
        "-e", "dec-20220614-security-review-gate",
        "-s", "drop-2024-03-01-review",
        "-B",
        "-m", "2022 security review gate (backfilled)",
        "decisions.md",
      ],
      { cwd: repo, encoding: "utf8" },
    );
    const commits = readFindingCommits(repo);
    expect(commits[0]!.backfill).toBe(true);
    expect(commits[0]!.source).toBe("drop-2024-03-01-review");
  });

  it("omits the Backfill trailer when -B is absent", () => {
    const repo = initRepo();
    writeFileSync(path.join(repo, "decisions.md"), "new decision\n");
    execFileSync(
      "bash",
      [GATE, "-c", "t", "-t", "decision-new", "-e", "dec-1", "-s", "drop-2024-01-01-x", "-m", "m", "decisions.md"],
      { cwd: repo, encoding: "utf8" },
    );
    expect(readFindingCommits(repo)[0]!.backfill).toBeUndefined();
  });

  it("covers every documented finding type", () => {
    // Guard against taxonomy drift between FINDINGS.md, trailers.ts and the gate.
    const gateSource = execFileSync("cat", [GATE], { encoding: "utf8" });
    for (const t of FINDING_TYPES) expect(gateSource).toContain(t);
  });
});
