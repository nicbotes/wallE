import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrain, parseEntityBlocks, parseAllBlocks } from "./lib/parser.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "clients");

describe("parseEntityBlocks", () => {
  it("parses heading + yaml + prose", () => {
    const errors: string[] = [];
    const blocks = parseEntityBlocks(
      `# File\n\n## Ada Vance (sh-ada-vance)\n\n\`\`\`yaml\nid: sh-ada-vance\nrole: CTO\n\`\`\`\n\nSome prose here.\n`,
      "test.md",
      errors,
    );
    expect(errors).toEqual([]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.id).toBe("sh-ada-vance");
    expect(blocks[0]!.displayName).toBe("Ada Vance");
    expect(blocks[0]!.fields["role"]).toBe("CTO");
    expect(blocks[0]!.prose).toBe("Some prose here.");
  });

  it("flags heading/yaml id mismatch and missing yaml", () => {
    const errors: string[] = [];
    parseEntityBlocks(
      `## A (sh-a)\n\n\`\`\`yaml\nid: sh-b\n\`\`\`\n\n## C (sh-c)\n\nno yaml\n`,
      "test.md",
      errors,
    );
    expect(errors.some((e) => e.includes('heading id "sh-a" != yaml id "sh-b"'))).toBe(true);
    expect(errors.some((e) => e.includes("has no yaml block"))).toBe(true);
  });

  it("ignores commented-out template examples", () => {
    const errors: string[] = [];
    const blocks = parseEntityBlocks(
      `# File\n\n<!--\n## Example (sh-example)\n\n\`\`\`yaml\nid: sh-example\n\`\`\`\n-->\n`,
      "test.md",
      errors,
    );
    expect(blocks).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("tracks In/Out/Undecided sections for scope items", () => {
    const errors: string[] = [];
    const blocks = parseEntityBlocks(
      `# Scope\n\n## In\n\n## A (scp-a)\n\n\`\`\`yaml\nid: scp-a\nstate: in\n\`\`\`\n\n## Undecided\n\n## B (scp-b)\n\n\`\`\`yaml\nid: scp-b\nstate: undecided\n\`\`\`\n`,
      "scope.md",
      errors,
    );
    expect(blocks.map((b) => b.section)).toEqual(["in", "undecided"]);
  });
});

describe("parseBrain on the testco fixture", () => {
  const brain = parseBrain(FIXTURES, "testco");

  it("parses cleanly", () => {
    expect(brain.parseErrors).toEqual([]);
  });

  it("reads profile, stakeholders, incentives, tensions", () => {
    expect(brain.profile?.id).toBe("testco");
    expect(brain.stakeholders.map((s) => s.id).sort()).toEqual([
      "sh-ada-vance", "sh-bo-reyes", "sh-jules-marek",
    ]);
    expect(brain.incentives[0]!.kind).toBe("inferred");
    expect(brain.tensions[0]!.resolved_by).toBe("dec-20240301-phased-rollout");
  });

  it("reads stakeholder side and aliases", () => {
    const ada = brain.stakeholders.find((s) => s.id === "sh-ada-vance")!;
    expect(ada.side).toBe("client");
    expect(ada.aliases).toContain("Ada");
    const ours = brain.stakeholders.find((s) => s.id === "sh-jules-marek")!;
    expect(ours.side).toBe("us");
  });

  it("reads tension positions (IBIS)", () => {
    const t = brain.tensions.find((x) => x.id === "ten-speed-vs-spend")!;
    expect(t.positions).toHaveLength(2);
    expect(t.positions![0]).toEqual({
      stakeholder: "sh-ada-vance",
      summary: "Wants everything live at once so the platform story lands in one go.",
    });
    // A tension without positions parses fine — the field is optional.
    expect(brain.tensions.find((x) => x.id === "ten-dashboard-ownership")!.positions)
      .toBeUndefined();
  });

  it("reads observations, including org-scoped ones", () => {
    expect(brain.observations.map((o) => o.id).sort()).toEqual([
      "obs-ada-opens-with-roadmap", "obs-budget-cycle-locks-march",
    ]);
    const org = brain.observations.find((o) => o.about === "org")!;
    expect(org.kind).toBe("process");
    expect(org.confidence).toBe("high");
  });

  it("reads a transcript drop with its source tool", () => {
    const t = brain.drops.find((d) => d.id === "drop-2024-03-01-review")!;
    expect(t.type).toBe("transcript");
    expect(t.source_tool).toBe("fathom");
  });

  it("reads drops with paths", () => {
    expect(brain.drops).toHaveLength(3);
    expect(brain.drops[0]!.id).toBe("drop-2024-01-05-kickoff");
    expect(brain.drops[0]!.path).toBe("drops/2024-01-05-kickoff.md");
  });

  it("reads project scope with sections, requirements, decisions, log", () => {
    const p = brain.projects[0]!;
    expect(p.charter?.id).toBe("proj-widget");
    expect(p.scope.find((s) => s.id === "scp-reporting-module")?.section).toBe("in");
    expect(p.scope.find((s) => s.id === "scp-mobile-app")?.section).toBe("undecided");
    expect(p.requirements.map((r) => r.id)).toContain("req-audit-trail");
    expect(p.decisions.find((d) => d.id === "dec-20240105-big-bang")?.status).toBe("superseded");
    expect(p.log[0]!.kind).toBe("milestone");
  });

  it("parseAllBlocks returns blocks with prose across files", () => {
    const blocks = parseAllBlocks(FIXTURES, "testco");
    const ada = blocks.find((b) => b.id === "sh-ada-vance");
    expect(ada?.prose).toContain("platform story");
  });
});
