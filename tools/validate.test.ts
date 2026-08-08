import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBrain } from "./lib/parser.js";
import { validateBrain } from "./validate.js";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__", "clients");

describe("validateBrain on the clean fixture", () => {
  const result = validateBrain(parseBrain(FIXTURES, "testco"));

  it("has no errors", () => {
    expect(result.errors).toEqual([]);
  });

  it("warns about the unattributed requirement", () => {
    expect(result.warnings.some((w) => w.includes("req-fast-dashboards"))).toBe(true);
  });

  it("accepts backfill — an event dated long before the drop that taught us", () => {
    // dec-20220614-security-review-gate: 2022 decision, learned via a 2024 drop.
    expect(result.errors.filter((e) => e.includes("security-review-gate"))).toEqual([]);
  });
});

describe("validateBrain on the poisoned fixture", () => {
  const result = validateBrain(parseBrain(FIXTURES, "brokenco"));
  const all = result.errors.join("\n");

  const expectError = (fragment: string) => {
    expect(all, `expected an error containing: ${fragment}\ngot:\n${all}`).toContain(fragment);
  };

  it("catches profile violations", () => {
    expectError('id "broken-co-wrong-slug" != directory slug');
    expectError("schema_version missing or not a number");
  });

  it("catches enum violations", () => {
    expectError('disposition "enthusiastic"');
    expectError('kind "guessed"');
    expectError('type "seance"');
    expectError('status "shipped"');
    expectError('kind "catastrophe"');
  });

  it("catches dangling references", () => {
    expectError('reports_to "sh-nobody-here"');
    expectError('projects ref "proj-ghost"');
    expectError('first_seen "drop-2024-01-01-missing"');
    expectError('resolved_by "dec-nonexistent"');
    expectError('involves "sh-ghost"');
  });

  it("catches broken supersession chains", () => {
    expectError("dec-20240301-orphan.superseded_by should be");
    expectError("dec-20240301-orphan should have status superseded");
  });

  it("catches tension resolved without a date", () => {
    expectError("(ten-ghost-fight): missing resolved");
  });

  it("catches an event dated later than the drop that taught us", () => {
    expectError("date 2025-09-01 is later than its source drop drop-2024-03-15-workshop");
  });

  it("catches a drop ingested before it was written", () => {
    expectError("ingested 2024-03-01 is earlier than the drop date 2024-03-15");
  });

  it("catches scope section/state mismatch and out-of-section items", () => {
    expectError('state "out" but sits under section "## in"');
    expect(all).toMatch(/scp-homeless.*outside the In\/Out\/Undecided|sits outside/);
  });

  it("catches missing yaml blocks and drop filename mismatch", () => {
    expectError("has no yaml block");
    expectError("filename does not match id");
  });

  it("catches id prefix violations and duplicates", () => {
    expectError("id must start with req-");
    expectError("id must start with proj-");
    expectError("duplicate id: ten-ghost-fight");
  });

  it("treats unattributed requirements as warnings, not errors", () => {
    expect(result.warnings.some((w) => w.includes("req-unowned-wish"))).toBe(true);
    expect(result.errors.some((e) => e.includes("req-unowned-wish"))).toBe(false);
  });
});
