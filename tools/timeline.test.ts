import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

interface Row {
  date: string;
  kind: string;
  id: string;
  backfilled: boolean;
  learned?: string;
  source?: string;
  project?: string;
  topics: string[];
  supersedes?: string;
}

function timeline(...extra: string[]): Row[] {
  const out = execFileSync(
    "npx",
    ["tsx", "tools/timeline.ts", "testco", "--clients-dir", FIXTURES, "--json", ...extra],
    { cwd: REPO, encoding: "utf8" },
  );
  return JSON.parse(out) as Row[];
}

describe("timeline (event time, not knowledge time)", () => {
  const rows = timeline();

  it("orders by when things happened", () => {
    const dates = rows.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("places a backfilled 2022 decision first, ahead of the 2024 drops", () => {
    expect(rows[0]!.id).toBe("dec-20220614-security-review-gate");
    expect(rows[0]!.date).toBe("2022-06-14");
  });

  it("marks backfilled rows with when we actually learned them", () => {
    const backfilled = rows.filter((r) => r.backfilled);
    expect(backfilled.map((r) => r.id)).toEqual(["dec-20220614-security-review-gate"]);
    expect(backfilled[0]!.learned).toBe("2024-03-01");
    expect(backfilled[0]!.source).toBe("drop-2024-03-01-review");
  });

  it("does not mark same-drop findings as backfill", () => {
    const kickoff = rows.filter((r) => r.date === "2024-01-05");
    expect(kickoff.length).toBeGreaterThan(1);
    expect(kickoff.every((r) => !r.backfilled)).toBe(true);
  });

  it("covers drops, decisions, requirements, tensions, scope, projects and logs", () => {
    const kinds = new Set(rows.map((r) => r.kind));
    for (const k of [
      "drop", "decision", "requirement", "tension-opened", "tension-resolved",
      "scope", "project-started", "log:milestone",
    ]) {
      expect(kinds, `missing kind ${k}`).toContain(k);
    }
  });

  it("filters by topic, keeping only tagged entities", () => {
    const tagged = timeline("--topic", "concern:delivery");
    expect(tagged.map((r) => r.id)).toEqual(["dec-20240301-phased-rollout"]);
    // A free-form topic works the same way.
    expect(timeline("--topic", "audit-evidence-format").map((r) => r.id)).toContain(
      "req-audit-trail",
    );
    // An unused topic yields nothing rather than everything.
    expect(timeline("--topic", "line:motor")).toEqual([]);
  });

  it("carries topics and supersession links on rows", () => {
    const dec = rows.find((r) => r.id === "dec-20240301-phased-rollout")!;
    expect(dec.topics).toContain("concern:delivery");
    expect(dec.supersedes).toBe("dec-20240105-big-bang");
  });

  it("filters by date range, project and backfill", () => {
    expect(timeline("--from", "2024-03-01").every((r) => r.date >= "2024-03-01")).toBe(true);
    expect(timeline("--to", "2023-01-01").map((r) => r.id)).toEqual([
      "dec-20220614-security-review-gate",
    ]);
    expect(timeline("--project", "widget").every((r) => r.project === "widget")).toBe(true);
    expect(timeline("--backfilled-only").every((r) => r.backfilled)).toBe(true);
  });
});
