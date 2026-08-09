import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

describe("timeline --html", () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), "tl-")), "timeline.html");
  execFileSync(
    "npx",
    ["tsx", "tools/timeline.ts", "testco", "--clients-dir", FIXTURES, "--html", out],
    { cwd: REPO, encoding: "utf8" },
  );
  const html = readFileSync(out, "utf8");

  it("is self-contained — no external references at all", () => {
    // It has to survive being emailed and opened from disk, and this repo
    // denies network tools in the first place.
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+href/i);
  });

  it("renders one item per event, in date order", () => {
    const dates = [...html.matchAll(/<time>(\d{4}-\d{2}-\d{2})<\/time>/g)].map((m) => m[1]!);
    expect(dates.length).toBeGreaterThan(10);
    expect([...dates].sort()).toEqual(dates);
  });

  it("marks the backfilled entry and says when we learned it", () => {
    expect(html).toContain("is-backfill");
    expect(html).toContain("backfilled — we only learned this on 2024-03-01");
  });

  it("draws the supersession as a replacement", () => {
    expect(html).toContain("replaces <strong>Big-bang rollout</strong>");
  });

  it("escapes label content rather than interpolating it raw", () => {
    // The fixture deliberately contains `Mobile app & <beta> access`.
    expect(html).toContain("Mobile app &amp; &lt;beta&gt; access");
    expect(html).not.toContain("<beta>");
  });

  it("labels itself internal, pointing at client-view for external use", () => {
    expect(html).toContain("client-view.ts");
  });
});
