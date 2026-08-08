import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

interface ClientStats {
  client: string;
  drops: { files: number; words: number; bytes: number; tokens: number };
  brain: { files: number; words: number; bytes: number; tokens: number };
  compression: number;
}

function stats(...extra: string[]): ClientStats[] {
  const out = execFileSync(
    "npx",
    ["tsx", "tools/stats.ts", "--clients-dir", FIXTURES, "--json", ...extra],
    { cwd: REPO, encoding: "utf8" },
  );
  return JSON.parse(out) as ClientStats[];
}

describe("stats (raw corpus vs projection)", () => {
  it("measures every client when none is named", () => {
    expect(stats().map((s) => s.client).sort()).toEqual(["brokenco", "testco"]);
  });

  it("separates drops from the curated brain", () => {
    const s = stats("testco")[0]!;
    expect(s.drops.files).toBe(3); // the fixture's three drops
    expect(s.brain.files).toBeGreaterThan(s.drops.files);
    expect(s.drops.words).toBeGreaterThan(0);
    expect(s.brain.words).toBeGreaterThan(0);
  });

  it("does not count drops inside the brain measurement", () => {
    const s = stats("testco")[0]!;
    // brain excludes drops/, so the two are disjoint — their file counts must
    // not overlap with a combined walk of the client directory.
    expect(s.brain.files + s.drops.files).toBe(14);
  });

  it("estimates tokens from words", () => {
    const s = stats("testco")[0]!;
    expect(s.drops.tokens).toBeGreaterThan(s.drops.words);
    expect(s.brain.tokens).toBeGreaterThan(s.brain.words);
  });

  it("reports a compression ratio", () => {
    const s = stats("testco")[0]!;
    expect(s.compression).toBeCloseTo(s.drops.words / s.brain.words, 1);
  });
});
