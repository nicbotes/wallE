/**
 * Offline corpus checks — no API key, no agent. Guards the corpus itself:
 * manifest/drops/goldens consistency, matcher/binding sanity, and the
 * leakage lint that keeps the capability layer corpus-agnostic.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS = path.join(REPO, "eval", "corpus", "meridian-energy");

const manifest = parseYaml(readFileSync(path.join(CORPUS, "manifest.yaml"), "utf8")) as {
  client: { name: string; slug: string };
  drops: { seq: number; file: string; id: string; date: string; type: string; title: string }[];
};

describe("manifest", () => {
  it("has 16 sequential drops", () => {
    expect(manifest.drops).toHaveLength(16);
    expect(manifest.drops.map((d) => d.seq)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
  });

  it("every drop file exists and is non-trivial", () => {
    for (const d of manifest.drops) {
      const p = path.join(CORPUS, d.file);
      expect(existsSync(p), `${d.file} missing`).toBe(true);
      expect(readFileSync(p, "utf8").length, `${d.file} too short`).toBeGreaterThan(400);
    }
  });

  it("dates are strictly increasing and ids embed them", () => {
    const dates = manifest.drops.map((d) => String(d.date));
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!, `${dates[i]} !> ${dates[i - 1]}`).toBe(true);
    }
    for (const d of manifest.drops) {
      expect(d.id.startsWith(`drop-${d.date}-`), `${d.id} vs ${d.date}`).toBe(true);
    }
  });

  it("drop bodies are raw material — no frontmatter (creating it is the skill's job)", () => {
    for (const d of manifest.drops) {
      const body = readFileSync(path.join(CORPUS, d.file), "utf8");
      expect(body.startsWith("---"), `${d.file} must not ship frontmatter`).toBe(false);
    }
  });
});

describe("goldens", () => {
  const goldenFiles = manifest.drops.map((d) => ({
    drop: d,
    file: `goldens/after-${String(d.seq).padStart(2, "0")}.yaml`,
  }));

  it("one golden per drop, drop ids line up", () => {
    for (const { drop, file } of goldenFiles) {
      const p = path.join(CORPUS, file);
      expect(existsSync(p), `${file} missing`).toBe(true);
      const g = parseYaml(readFileSync(p, "utf8")) as { drop: string };
      expect(g.drop, file).toBe(drop.id);
    }
  });

  it("commit_protocol.source matches the drop; min_findings has a drop commit", () => {
    for (const { drop, file } of goldenFiles) {
      const g = parseYaml(readFileSync(path.join(CORPUS, file), "utf8")) as {
        deterministic?: { commit_protocol?: { source: string; min_findings: Record<string, number> } };
      };
      const cp = g.deterministic?.commit_protocol;
      expect(cp, `${file}: commit_protocol missing`).toBeTruthy();
      expect(cp!.source, file).toBe(drop.id);
      expect(cp!.min_findings["drop"], `${file}: drop commit`).toBe(1);
    }
  });

  it("every {ref:} has a matching as: binding in the same golden", () => {
    for (const { file } of goldenFiles) {
      const raw = readFileSync(path.join(CORPUS, file), "utf8");
      const g = parseYaml(raw) as Record<string, unknown>;
      const bindings = new Set<string>();
      const refs: string[] = [];
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === "object") {
          const o = node as Record<string, unknown>;
          if (typeof o["as"] === "string") bindings.add(o["as"]);
          if (typeof o["ref"] === "string") refs.push(o["ref"]);
          Object.values(o).forEach(walk);
        }
      };
      walk(g);
      for (const r of refs) {
        expect(bindings.has(r), `${file}: ref ${r} has no as: binding`).toBe(true);
      }
    }
  });

  it("golden matchers use only known keys and entity types", () => {
    const KNOWN_TYPES = new Set([
      "stakeholders", "projects", "incentives", "decisions", "requirements",
      "tensions", "scope", "logs", "drops", "commit_protocol",
    ]);
    const KNOWN_MATCH_KEYS = new Set(["id", "file", "date", "keywords_any", "project", "kind"]);
    for (const { file } of goldenFiles) {
      const g = parseYaml(readFileSync(path.join(CORPUS, file), "utf8")) as {
        deterministic?: Record<string, unknown>;
      };
      for (const [type, section] of Object.entries(g.deterministic ?? {})) {
        expect(KNOWN_TYPES.has(type), `${file}: unknown section ${type}`).toBe(true);
        if (!Array.isArray(section)) continue;
        for (const assertion of section as { match?: Record<string, unknown> }[]) {
          for (const k of Object.keys(assertion.match ?? {})) {
            expect(KNOWN_MATCH_KEYS.has(k), `${file}: unknown match key ${k}`).toBe(true);
          }
        }
      }
    }
  });
});

describe("entities allowlist", () => {
  it("parses, with from-indexes in range", () => {
    const e = parseYaml(
      readFileSync(path.join(CORPUS, "goldens", "entities.yaml"), "utf8"),
    ) as Record<string, { from: number }[]>;
    const types = Object.keys(e);
    expect(types).toContain("stakeholders");
    expect(types).toContain("decisions");
    for (const entries of Object.values(e)) {
      for (const entry of entries) {
        expect(entry.from).toBeGreaterThanOrEqual(1);
        expect(entry.from).toBeLessThanOrEqual(16);
      }
    }
  });
});

describe("leakage lint", () => {
  it("capability layer contains no corpus proper nouns", () => {
    // Corpus-specific names must never leak into skills/schema/tools —
    // that would let the ingest skill "know" the answers.
    const STOPLIST = [
      // proper nouns
      "meridian", "priya", "sharma", "marcus", "webb", "okafor",
      "nagel", "aisha", "hermes", "billflow",
      // storyline structure — would hint the expected extractions
      "billing-replatform", "customer-portal", "dual-run", "selfhost",
      "managed-cloud", "mobile-payments", "postgres",
    ];
    const targets = [".claude", "schema", "tools"].map((d) => path.join(REPO, d));
    for (const target of targets) {
      for (const word of STOPLIST) {
        let out = "";
        try {
          out = execFileSync("rg", ["-il", word, target], { encoding: "utf8" });
        } catch {
          continue; // rg exit 1 = no matches = good
        }
        expect.fail(`"${word}" leaked into capability layer:\n${out}`);
      }
    }
  });

  it("corpus is never referenced from the client template", () => {
    const template = path.join(REPO, "schema", "templates");
    const files = readdirSync(template, { recursive: true });
    expect(files.length).toBeGreaterThan(0);
    let out = "";
    try {
      out = execFileSync("rg", ["-il", "eval/", template], { encoding: "utf8" });
    } catch {
      return;
    }
    expect.fail(`template references eval/:\n${out}`);
  });
});
