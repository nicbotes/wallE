/**
 * The client-safe view is a SAFETY boundary, so it is tested like one: the
 * assertions are mostly about what must NOT be present. The testco fixture is
 * deliberately loaded with material that would be damaging in a client deck —
 * dispositions, an inferred motive about someone "angling for a group-level
 * role", observations about how to handle people, one of our own consultants,
 * and an unresolved disagreement neither party has voiced.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

const run = (...extra: string[]): string =>
  execFileSync(
    "npx",
    ["tsx", "tools/client-view.ts", "testco", "--clients-dir", FIXTURES, ...extra],
    { cwd: REPO, encoding: "utf8" },
  );

const markdown = run();
const json = JSON.parse(run("--json")) as {
  people: { name: string; role: string }[];
  projects: { decisions: unknown[]; requirements: unknown[]; scope: { in: string[] } }[];
  decisions: { title: string; replaces: string | null }[];
  resolved_questions: { question: string; considerations: string[] }[];
  open_questions?: { question: string; considerations: string[] }[];
  review_required: { where: string; signal: string; text: string }[];
};

/** Everything the fixture holds that must never reach a client. */
const MUST_NOT_LEAK: [string, string][] = [
  ["disposition value", "champion"],
  ["disposition value", "skeptical"],
  ["influence rating", "influence"],
  ["inferred motive", "angling for a group-level role"],
  ["incentive framing", "Counts every penny"],
  ["observation about handling a person", "proposals land better"],
  ["observation about the org", "waits a full year"],
  ["our own consultant", "Jules Marek"],
  ["our own consultant id", "sh-jules-marek"],
  ["unvoiced disagreement", "Nobody has said this out loud"],
  ["confidence marker", "confidence"],
  ["entity ids", "sh-ada-vance"],
];

describe("client-view: what must not leak", () => {
  for (const [label, needle] of MUST_NOT_LEAK) {
    it(`excludes ${label} ("${needle}")`, () => {
      expect(markdown.toLowerCase()).not.toContain(needle.toLowerCase());
      expect(JSON.stringify(json).toLowerCase()).not.toContain(needle.toLowerCase());
    });
  }

  it("proves those strings really are in the source brain", () => {
    // Guards against the test passing because the fixture is empty.
    const raw = ["stakeholders.md", "incentives.md", "observations.md", "tensions.md"]
      .map((f) => readFileSync(path.join(FIXTURES, "testco", f), "utf8"))
      .join("\n")
      .toLowerCase();
    for (const [, needle] of MUST_NOT_LEAK) {
      if (needle === "confidence" || needle === "influence") continue; // field names, not prose
      expect(raw, `fixture should contain "${needle}"`).toContain(needle.toLowerCase());
    }
  });

  it("names client people but only with their role", () => {
    expect(json.people).toEqual([
      { name: "Ada Vance", role: "CTO" },
      { name: "Bo Reyes", role: "Finance Director" },
    ]);
  });
});

describe("client-view: what it must include", () => {
  it("keeps decisions and their supersession chain", () => {
    const proj = json.projects[0]!;
    expect(proj.decisions).toHaveLength(2);
    expect(markdown).toContain("Phased rollout");
    expect(markdown).toContain('replaced the earlier decision "Big-bang rollout"');
  });

  it("keeps requirements and scope", () => {
    expect(markdown).toContain("Audit trail on every widget change");
    expect(json.projects[0]!.scope.in).toContain("Reporting module");
  });

  it("keeps org-level decisions, including backfilled ones", () => {
    expect(json.decisions.map((d) => d.title)).toContain(
      "No production data without a security review",
    );
  });

  it("states how much material it was compiled from", () => {
    expect(markdown).toContain("Compiled from 3 recorded conversations");
  });
});

describe("client-view: tensions are depersonalised", () => {
  it("includes a resolved question and what settled it", () => {
    expect(json.resolved_questions).toEqual([
      {
        question: "Speed vs spend",
        opened: "2024-01-05",
        resolved: "2024-03-01",
        resolved_by: "Phased rollout",
        considerations: [
          "Wants everything live at once so the platform story lands in one go.",
          "Wants spend gated per phase after being burned by the last vendor.",
        ],
      },
    ]);
  });

  it("carries the substance of each position WITHOUT who argued it", () => {
    // The IBIS payoff: a client can be told what was weighed, not who fought.
    const q = json.resolved_questions[0]!;
    expect(q.considerations).toHaveLength(2);
    expect(JSON.stringify(q)).not.toContain("stakeholder");
    expect(JSON.stringify(q)).not.toContain("sh-");
    expect(markdown).toContain("considered: Wants everything live at once");
  });

  it("never says who was on which side", () => {
    expect(markdown).not.toContain("Ada wanted big-bang");
    expect(JSON.stringify(json)).not.toContain("between");
    expect(JSON.stringify(json)).not.toContain("positions");
  });

  it("withholds open tensions by default", () => {
    expect(json.open_questions).toBeUndefined();
    expect(markdown).not.toContain("Who owns the dashboards");
  });

  it("surfaces open tensions only when explicitly asked", () => {
    const opened = JSON.parse(run("--json", "--include-open-tensions")) as {
      open_questions: { question: string }[];
    };
    expect(opened.open_questions.map((q) => q.question)).toEqual(["Who owns the dashboards"]);
    // …and still without the parties or the unvoiced detail.
    expect(JSON.stringify(opened)).not.toContain("sh-ada-vance");
    expect(JSON.stringify(opened)).not.toContain("Nobody has said this out loud");
  });
});

describe("client-view: prose is flagged, not trusted", () => {
  it("flags our own framing in decision rationale", () => {
    // Structured fields are filtered exhaustively; prose is passed through, so
    // the tool must say which passages need a human read.
    expect(json.review_required.length).toBeGreaterThan(0);
    const flagged = json.review_required.map((f) => f.text).join(" ");
    expect(flagged).toContain("won the argument");
  });

  it("says plainly in the Markdown that it is not client-ready as-is", () => {
    expect(markdown).toContain("Not client-ready as-is");
  });
});

describe("client-view: project filtering", () => {
  it("scopes to one project", () => {
    const one = JSON.parse(run("--json", "--project", "proj-widget")) as {
      projects: { id: string }[];
    };
    expect(one.projects.map((p) => p.id)).toEqual(["proj-widget"]);
  });
});
