/**
 * The upstream half of the boundary client-view.ts guards going out to clients:
 * brain material must not reach a public issue tracker.
 *
 * The scratch brain below stands in for a real deployment and uses names that
 * appear NOWHERE in this repo — otherwise the tests would be checking the
 * shipped fixtures against themselves, and the allowlist would make everything
 * pass for the wrong reason.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAIN_JARGON } from "./lib/redaction.js";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TMP = mkdtempSync(path.join(tmpdir(), "issue-check-"));

/** A minimal private brain: one client, one org, one person with an alias. */
const CLIENTS = path.join(TMP, "clients");
mkdirSync(path.join(CLIENTS, "verity"), { recursive: true });
writeFileSync(
  path.join(CLIENTS, "verity", "client.md"),
  "# Verity Holdings\n\n```yaml\nid: verity\nname: Verity Holdings\nschema_version: 1\n```\n",
);
writeFileSync(
  path.join(CLIENTS, "verity", "stakeholders.md"),
  [
    "# Stakeholders",
    "",
    "## Nova Kirsch (sh-nova-kirsch)",
    "",
    "```yaml",
    "id: sh-nova-kirsch",
    "name: Nova Kirsch",
    "role: COO",
    'aliases: ["Nova K", "nova@verity.example"]',
    "status: active",
    "disposition: neutral",
    "influence: high",
    "projects: []",
    "first_seen: drop-2024-05-02-kickoff",
    "last_confirmed: 2024-05-02",
    "sources: [drop-2024-05-02-kickoff]",
    "```",
    "",
  ].join("\n"),
);

interface Result {
  coverage: string;
  identifiers: number;
  leaks: { line: number; kind: string; term: string; severity: string }[];
}

let n = 0;
function check(body: string, clientsDir = CLIENTS): { out: Result; code: number } {
  const file = path.join(TMP, `draft-${n++}.md`);
  writeFileSync(file, body);
  let code = 0;
  let stdout = "";
  try {
    stdout = execFileSync(
      "npx",
      ["tsx", "tools/issue-check.ts", file, "--clients-dir", clientsDir, "--json"],
      { cwd: REPO, encoding: "utf8" },
    );
  } catch (e) {
    const err = e as { status: number; stdout: string };
    code = err.status;
    stdout = err.stdout;
  }
  return { out: JSON.parse(stdout) as Result, code };
}

const errorTerms = (r: Result): string[] =>
  r.leaks.filter((l) => l.severity === "error").map((l) => l.term.toLowerCase());

describe("issue-check catches what a draft must not carry", () => {
  it("flags a person, an organisation and a client slug from the local brains", () => {
    const { out, code } = check(
      "Ingest crashed reading the brain.\nNova Kirsch is listed under Verity Holdings in verity.\n",
    );
    expect(code).toBe(1);
    expect(errorTerms(out)).toEqual(
      expect.arrayContaining(["nova kirsch", "verity holdings", "verity"]),
    );
  });

  it("flags an alias, which is how a person appears in transcripts", () => {
    const { out, code } = check("Reported by Nova K after the workshop.\n");
    expect(code).toBe(1);
    expect(errorTerms(out)).toContain("nova k");
  });

  it("flags identifiers, which encode the names they were derived from", () => {
    const { out, code } = check("validate.ts rejects sh-nova-kirsch in tensions.md\n");
    expect(code).toBe(1);
    expect(errorTerms(out)).toContain("sh-nova-kirsch");
  });

  it("flags a drop id, which leaks a meeting date and its subject", () => {
    const { out, code } = check("Reproduced on drop-2024-07-18-steering.\n");
    expect(code).toBe(1);
    expect(out.leaks.some((l) => l.kind === "drop identifier")).toBe(true);
  });

  it("flags industry vocabulary from the list the leakage lint shares", () => {
    // Built from DOMAIN_JARGON rather than a literal, for two reasons: the
    // test cannot drift from the real list, and a hardcoded term here would
    // itself trip the lint that keeps this vocabulary out of the repo.
    const term = DOMAIN_JARGON[0]!;
    const { out, code } = check(`The ${term} tier needs another field.\n`);
    expect(code).toBe(1);
    expect(errorTerms(out)).toContain(term.toLowerCase());
  });

  it("flags pasted transcript lines and email addresses", () => {
    const { out, code } = check("Someone (00:14:02) said it\nContact: a@b.example\n");
    expect(code).toBe(1);
    expect(out.leaks.map((l) => l.kind)).toEqual(
      expect.arrayContaining(["transcript line", "email address"]),
    );
  });

  it("reports the line so the author can find it", () => {
    const { out } = check("line one is fine\nline two mentions Nova Kirsch\n");
    expect(out.leaks.find((l) => l.term === "Nova Kirsch")?.line).toBe(2);
  });
});

describe("issue-check does not punish the behaviour CONTRIBUTING.md asks for", () => {
  // The guide says: rebuild the repro on the shipped fixtures. Those names are
  // already published here, so flagging them would penalise doing it right and
  // train contributors to ignore the checker.
  const correct = [
    "## What happens",
    "",
    "A tension whose `positions` name a stakeholder absent from `between` is",
    "accepted by the validator.",
    "",
    "## Reproduce",
    "",
    "```bash",
    "npx tsx tools/validate.ts brokenco --clients-dir tools/__fixtures__/clients",
    "npx tsx tools/validate.ts testco --clients-dir tools/__fixtures__/clients",
    "```",
    "",
    "Ada Vance and Bo Reyes are enough to show it.",
    "",
  ].join("\n");

  it("passes a report built on the public fixtures", () => {
    const { out, code } = check(correct);
    expect(code).toBe(0);
    expect(out.leaks.filter((l) => l.severity === "error")).toEqual([]);
  });

  it("still had real identifiers loaded, so the pass is not vacuous", () => {
    const { out } = check(correct);
    expect(out.identifiers).toBeGreaterThan(0);
    expect(out.coverage).toContain("compared against");
  });
});

describe("issue-check is honest about what it could not check", () => {
  it("says loudly when there are no brains, rather than reporting a clean zero", () => {
    // The dangerous case: a clean checkout of the public shell has nothing to
    // compare against, so "0 findings" would badly overstate the assurance.
    const { out, code } = check("Nova Kirsch hit a bug.\n", path.join(TMP, "absent"));
    expect(code).toBe(0);
    expect(out.identifiers).toBe(0);
    expect(out.coverage).toContain("NO BRAINS FOUND");
    // …and the name really does slip through, which is exactly why it says so.
    expect(errorTerms(out)).not.toContain("nova kirsch");
  });
});
