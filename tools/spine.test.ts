import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyTopic,
  hasTerm,
  listDomains,
  loadSpine,
  loadSpineRaw,
  resolvePhrase,
  validateSpine,
  type Spine,
} from "./lib/spine.js";

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(REPO, "tools", "__fixtures__", "clients");

describe("domain packs", () => {
  it("lists attachable packs, excluding the scaffolding template", () => {
    const packs = listDomains(REPO);
    expect(packs).toContain("_base");
    expect(packs).toContain("insurance");
    expect(packs).not.toContain("_template");
  });

  it("every shipped pack is structurally valid", () => {
    for (const d of listDomains(REPO)) {
      expect(validateSpine(loadSpine(d, REPO)), d).toEqual([]);
    }
  });

  it("merges extends — insurance inherits base engagement concerns", () => {
    const raw = loadSpineRaw("insurance", REPO);
    const merged = loadSpine("insurance", REPO);
    expect(raw.facets.map((f) => f.id)).not.toContain("concern");
    expect(merged.facets.map((f) => f.id)).toEqual(["concern", "line", "component", "stage"]);
  });

  it("rejects a malformed spine", () => {
    const bad = {
      domain: "bad",
      label: "Bad",
      version: "one",
      facets: [
        { id: "f", label: "F", terms: [{ id: "t", label: "T" }, { id: "t", label: "Dup" }] },
        { id: "f", label: "Dup facet", terms: [] },
      ],
    } as unknown as Spine;
    const errors = validateSpine(bad).join("\n");
    expect(errors).toContain("version must be a number");
    expect(errors).toContain('duplicate term "f:t"');
    expect(errors).toContain('duplicate facet id "f"');
    expect(errors).toContain('facet "f" has no terms');
  });

  it("detects circular extends", () => {
    expect(() => loadSpine("insurance", REPO, ["_base", "insurance"])).toThrow(/circular/);
  });
});

describe("topic classification", () => {
  const spines = [loadSpine("insurance", REPO)];

  it("treats a bare slug as free-form and always valid", () => {
    const t = classifyTopic("renewal-pricing-quirk", spines);
    expect(t.form).toBe("free");
    expect(t.resolved).toBeUndefined();
  });

  it("resolves a controlled topic against the spine", () => {
    const t = classifyTopic("component:coverage", spines);
    expect(t).toMatchObject({ form: "controlled", facet: "component", term: "coverage", resolved: true });
  });

  it("resolves inherited base facets too", () => {
    expect(classifyTopic("concern:migration", spines).resolved).toBe(true);
  });

  it("flags a controlled topic that does not resolve", () => {
    expect(classifyTopic("component:teleportation", spines).resolved).toBe(false);
    expect(classifyTopic("nosuchfacet:coverage", spines).resolved).toBe(false);
  });

  it("hasTerm answers directly", () => {
    expect(hasTerm(spines, "line", "motor")).toBe(true);
    expect(hasTerm(spines, "line", "spaceships")).toBe(false);
  });
});

describe("phrase resolution", () => {
  const spines = [loadSpine("insurance", REPO)];
  const topics = (phrase: string) => resolvePhrase(phrase, spines).map((h) => h.topic);

  it("matches synonyms, not just labels", () => {
    expect(topics("we need to change the cover on their policy")).toContain("component:coverage");
    expect(topics("the MTA process is broken")).toContain("component:endorsement");
  });

  it("matches on word boundaries — 'discovery' is not 'cover'", () => {
    expect(topics("during discovery we found issues")).not.toContain("component:coverage");
  });

  it("keeps colliding synonyms disambiguated across facets", () => {
    // "schedule" means a policy document here, not delivery timing.
    const hits = topics("they want the benefit schedule as a PDF");
    expect(hits).toContain("component:document");
    expect(hits).not.toContain("concern:delivery");
  });

  it("returns nothing for text the spine doesn't cover", () => {
    expect(topics("the coffee machine is broken again")).toEqual([]);
  });
});

describe("spine CLI", () => {
  const run = (...a: string[]) =>
    execFileSync("npx", ["tsx", "tools/spine.ts", ...a], { cwd: REPO, encoding: "utf8" });

  it("validate passes for shipped packs", () => {
    expect(run("validate")).toContain("valid ✓ insurance");
  });

  it("candidates reports recurring free-form topics with client counts", () => {
    const out = JSON.parse(
      run("candidates", "--clients-dir", FIXTURES, "--min", "1", "--json"),
    ) as { topic: string; count: number; clients: string[] }[];
    const audit = out.find((r) => r.topic === "audit-evidence-format");
    expect(audit, JSON.stringify(out)).toBeTruthy();
    expect(audit!.count).toBe(2); // requirement + observation in testco
    expect(audit!.clients).toEqual(["testco"]);
    // Controlled topics never appear as promotion candidates.
    expect(out.some((r) => r.topic.includes(":"))).toBe(false);
  });

  it("candidates respects --min", () => {
    const out = JSON.parse(
      run("candidates", "--clients-dir", FIXTURES, "--min", "2", "--json"),
    ) as { topic: string }[];
    expect(out.map((r) => r.topic)).not.toContain("fine-free-form-topic"); // appears once
  });
});
