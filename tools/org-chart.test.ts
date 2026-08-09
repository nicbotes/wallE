import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

const run = (slug: string, ...extra: string[]): string =>
  execFileSync("npx", ["tsx", "tools/org-chart.ts", slug, "--clients-dir", FIXTURES, ...extra], {
    cwd: REPO,
    encoding: "utf8",
  });

interface Node {
  id: string;
  name: string;
  tier: string;
  people: { id: string }[];
  authority_over: string[];
  children: Node[];
}

const chart = (slug: string) =>
  JSON.parse(run(slug, "--json")) as {
    orgs: Node[];
    unplaced_people: { id: string }[];
  };

describe("org-chart (the value chain, drawn)", () => {
  const testco = chart("testco");

  it("nests the chain under its roots", () => {
    expect(testco.orgs.map((o) => o.id)).toEqual(["org-crestline-group", "org-ours"]);
    const partner = testco.orgs[0]!.children[0]!;
    expect(partner.id).toBe("org-testco");
    expect(partner.children.map((c) => c.id)).toEqual(["org-brightline", "org-harbour-row"]);
  });

  it("puts each person under their organisation", () => {
    const partner = testco.orgs[0]!.children[0]!;
    expect(partner.people.map((p) => p.id)).toEqual(["sh-ada-vance", "sh-bo-reyes"]);
    expect(testco.orgs[1]!.people.map((p) => p.id)).toEqual(["sh-jules-marek"]);
    expect(testco.unplaced_people).toEqual([]);
  });

  it("shows which decisions each organisation had the right to make", () => {
    expect(testco.orgs[0]!.authority_over).toEqual(["dec-20240220-quarterly-risk-reporting"]);
  });

  it("prints the tier's meaning, not just its name", () => {
    const md = run("testco");
    expect(md).toContain("Crestline Group** — Parent group _(upstream: authority flows down from them)_");
    expect(md).toContain("Ada Vance, CTO");
  });

  it("terminates on a cyclic chain instead of hanging, and loses nothing", () => {
    // The poisoned fixture has org-loop-a ⇄ org-loop-b. validate.ts rejects
    // that, but this tool runs on brains nobody has validated yet.
    const broken = chart("brokenco");
    const ids = new Set<string>();
    const walk = (ns: Node[]): void => ns.forEach((n) => (ids.add(n.id), walk(n.children)));
    walk(broken.orgs);
    expect(ids).toContain("org-loop-a");
    expect(ids).toContain("org-loop-b");
    expect(ids).toContain("org-orphan-parent"); // dangling parent, still a root
  });

  it("lists people whose org does not resolve rather than dropping them", () => {
    // sh-cy-doe points at an org that isn't there. Vanishing from the chart
    // would hide exactly the person most likely to be mis-scoped later.
    expect(chart("brokenco").unplaced_people.map((p) => p.id)).toContain("sh-cy-doe");
  });

  it("says so plainly when a brain models a single organisation", () => {
    // Nothing here should imply an incomplete chain — most clients are one org.
    const md = execFileSync(
      "npx",
      ["tsx", "tools/org-chart.ts", "testco", "--clients-dir", path.join(REPO, "tools", "__fixtures__", "single-org")],
      { cwd: REPO, encoding: "utf8" },
    );
    expect(md).toContain("models a single organisation");
  });
});
