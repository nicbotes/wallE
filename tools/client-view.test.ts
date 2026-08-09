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
      { name: "Remy Alto", role: "Brand Lead" },
      { name: "Tess Orin", role: "Head of Marketing" },
      { name: "Nils Berg", role: "Risk Officer" },
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

/**
 * Audience scoping is the multi-organisation half of the same safety boundary.
 * The fixture is a real chain: Northwind Capacity above TestCo, two rival
 * distribution brands (Brightline, Harbour Row) below it, and our own team
 * alongside. The assertions that matter are again about absence — a brand must
 * see neither its parent's material nor its sibling's.
 */
interface AudienceView {
  audience: {
    org: string;
    name: string;
    chain: { name: string; relation: string }[];
    withheld: Record<string, number>;
  };
  people: { name: string }[];
  projects: {
    id: string;
    requirements: { title: string }[];
    decisions: { title: string }[];
    scope: { in: string[] };
  }[];
  decisions: { title: string }[];
  resolved_questions: unknown[];
}

const forAudience = (org: string, ...extra: string[]): AudienceView =>
  JSON.parse(run("--json", "--audience", org, ...extra)) as AudienceView;

describe("client-view: audience scoping across the value chain", () => {
  const brand = forAudience("org-brightline");
  const sibling = forAudience("org-harbour-row");
  const partner = forAudience("org-testco");

  it("names the audience and their own line of the chain", () => {
    expect(brand.audience.name).toBe("Brightline");
    expect(brand.audience.chain.map((c) => [c.name, c.relation])).toEqual([
      ["Northwind Capacity", "above"],
      ["TestCo", "above"],
      ["Brightline", "self"],
    ]);
  });

  it("never reveals a sibling brand to its rival", () => {
    const raw = JSON.stringify(brand);
    expect(raw).not.toContain("Harbour Row");
    expect(raw).not.toContain("Tess Orin");
    expect(raw).not.toContain("Pricing table on the quote page");
    // …and symmetrically.
    const other = JSON.stringify(sibling);
    expect(other).not.toContain("Brightline");
    expect(other).not.toContain("Remy Alto");
    expect(other).not.toContain("Brand-specific checkout copy");
  });

  it("shows a brand only its own people and its own requirements", () => {
    expect(brand.people.map((p) => p.name)).toEqual(["Remy Alto"]);
    expect(brand.projects[0]!.requirements.map((r) => r.title)).toEqual([
      "Brand-specific checkout copy",
    ]);
  });

  it("withholds the partner's own material from a brand", () => {
    const raw = JSON.stringify(brand);
    // TestCo's people, their decisions, and the scope they set.
    expect(raw).not.toContain("Ada Vance");
    expect(raw).not.toContain("Annual vendor review");
    expect(raw).not.toContain("No production data without a security review");
    expect(raw).not.toContain("Reporting module");
    // A tension between two TestCo people is TestCo's, even depersonalised.
    expect(brand.resolved_questions).toEqual([]);
    expect(raw).not.toContain("Speed vs spend");
  });

  it("withholds an upstream decision rather than inferring that it binds downward", () => {
    // Northwind's quarterly reporting rule applies to Brightline in practice,
    // but nobody from Brightline was party to it. Bindingness is not derivable
    // from tier, so the tool declines to guess with a client's data.
    expect(JSON.stringify(brand)).not.toContain("Quarterly risk reporting");
    // The organisation that DID make it sees it.
    const upstream = forAudience("org-northwind-capacity");
    expect(upstream.decisions.map((d) => d.title)).toEqual([
      "Quarterly risk reporting on the whole book",
    ]);
  });

  it("reports what it withheld, so a partial view is not read as complete", () => {
    expect(brand.audience.withheld["people"]).toBe(4);
    // The sibling's, the partner's, and the unattributed one — an unowned
    // requirement is withheld rather than guessed at.
    expect(brand.audience.withheld["requirements"]).toBe(3);
    expect(brand.audience.withheld["decisions"]).toBeGreaterThan(0);
    expect(brand.audience.withheld["scope"]).toBe(2);
    expect(brand.audience.withheld["resolved questions"]).toBe(1);
  });

  it("gives our counterparty their own material and nobody else's", () => {
    expect(partner.people.map((p) => p.name)).toEqual(["Ada Vance", "Bo Reyes"]);
    expect(partner.decisions.map((d) => d.title)).toEqual([
      "No production data without a security review",
      "Annual vendor review",
    ]);
    expect(partner.resolved_questions).toHaveLength(1);
    expect(JSON.stringify(partner)).not.toContain("Quarterly risk reporting");
  });

  it("still excludes our own people under every audience", () => {
    for (const v of [brand, sibling, partner]) {
      expect(JSON.stringify(v)).not.toContain("Jules Marek");
    }
    const ours = forAudience("org-ours");
    expect(ours.people).toEqual([]);
  });

  it("drops a project entirely when the audience has no stake in it", () => {
    // org-ours has no client-side people, so the project is not even named.
    const ours = forAudience("org-ours");
    expect(ours.projects).toEqual([]);
    expect(ours.audience.withheld["projects"]).toBe(1);
  });

  it("refuses an unknown audience rather than falling back to everyone", () => {
    // A typo must not silently hand one organisation everyone else's material.
    expect(() => run("--json", "--audience", "org-typo")).toThrow();
  });

  it("says in the Markdown who it was prepared for and what it left out", () => {
    const md = run("--audience", "org-brightline");
    expect(md).toContain("Prepared for Brightline");
    expect(md).toContain("Northwind Capacity — Capacity provider (above)");
    expect(md).toContain("Withheld as belonging to others");
    expect(md).not.toContain("Harbour Row");
  });
});
