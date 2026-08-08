import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

interface Row {
  label: string;
  turns: number;
  words: number;
  stakeholder: string | null;
  side: string | null;
  drops: string[];
}

function speakers(...extra: string[]): Row[] {
  const out = execFileSync(
    "npx",
    ["tsx", "tools/speakers.ts", "testco", "--clients-dir", FIXTURES, "--json", ...extra],
    { cwd: REPO, encoding: "utf8" },
  );
  return JSON.parse(out) as Row[];
}

describe("speakers (transcript labels → stakeholders)", () => {
  const rows = speakers("drop-2024-03-01-review");
  const byLabel = (l: string) => rows.find((r) => r.label === l);

  it("finds every distinct speaker label in the transcript", () => {
    expect(rows.map((r) => r.label).sort()).toEqual([
      "Ada Vance", "Bo", "Jules M.", "Ren Alvarez",
    ]);
  });

  it("resolves a full name to its stakeholder", () => {
    expect(byLabel("Ada Vance")?.stakeholder).toBe("sh-ada-vance");
  });

  it("resolves short-form and abbreviated labels via aliases", () => {
    expect(byLabel("Bo")?.stakeholder).toBe("sh-bo-reyes");
    expect(byLabel("Jules M.")?.stakeholder).toBe("sh-jules-marek");
  });

  it("reports which side each mapped speaker is on", () => {
    expect(byLabel("Ada Vance")?.side).toBe("client");
    expect(byLabel("Jules M.")?.side).toBe("us");
  });

  it("flags a speaker nobody has mapped yet", () => {
    expect(byLabel("Ren Alvarez")?.stakeholder).toBeNull();
    expect(speakers("drop-2024-03-01-review", "--unmapped").map((r) => r.label)).toEqual([
      "Ren Alvarez",
    ]);
  });

  it("counts turns and words per speaker", () => {
    const ada = byLabel("Ada Vance")!;
    expect(ada.turns).toBe(2);
    expect(ada.words).toBeGreaterThan(0);
  });

  it("aggregates across all drops when no drop is named", () => {
    const all = speakers();
    expect(all.length).toBeGreaterThanOrEqual(4);
    expect(all.find((r) => r.label === "Ada Vance")!.drops).toContain("drop-2024-03-01-review");
  });
});
