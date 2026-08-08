/**
 * Golden files: types, loading, and the matcher/binding resolution engine.
 *
 * Matchers make goldens robust to agent-chosen IDs: exact `id` where IDs are
 * deterministic (stakeholders, projects, drops), `{file, date, keywords_any}`
 * where the agent picks the slug (decisions, requirements, tensions, scope).
 * `as:` binds a resolved id to a variable; `{ref: VAR}` asserts against the
 * bound id — so supersession chains are asserted structurally.
 *
 * Resolution contract: 0 candidates = recall miss; >1 candidates = a GOLDEN
 * bug, surfaced loudly (fix the golden, not the skill).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { Brain, EntityBlock } from "../../tools/lib/types.js";

export interface Matcher {
  id?: string;
  file?: string;
  date?: string;
  keywords_any?: string[];
  project?: string; // logs only
  kind?: string; // logs only
}

export type ExpectValue =
  | string
  | number
  | null
  | { one_of: unknown[] }
  | { includes: string[] }
  | { ref: string };

export interface Assertion {
  match: Matcher;
  as?: string;
  expect?: Record<string, ExpectValue>;
}

export interface CommitProtocolGolden {
  source: string;
  min_findings: Record<string, number>;
}

export interface JudgeGolden {
  target: Matcher & { type: string };
  rubric: string;
}

export interface Golden {
  drop: string;
  deterministic: {
    stakeholders?: Assertion[];
    projects?: Assertion[];
    incentives?: Assertion[];
    decisions?: Assertion[];
    requirements?: Assertion[];
    tensions?: Assertion[];
    scope?: Assertion[];
    logs?: Assertion[];
    drops?: Assertion[];
    commit_protocol?: CommitProtocolGolden;
  };
  judge?: JudgeGolden[];
}

export type EntityType =
  | "stakeholders" | "projects" | "incentives" | "decisions"
  | "requirements" | "tensions" | "scope" | "logs" | "drops";

export function loadGolden(corpusDir: string, seq: number): Golden {
  const p = path.join(corpusDir, "goldens", `after-${String(seq).padStart(2, "0")}.yaml`);
  return parseYaml(readFileSync(p, "utf8")) as Golden;
}

export interface AllowlistEntry {
  from: number;
  match: Matcher;
  note?: string;
}

export function loadAllowlist(corpusDir: string): Record<string, AllowlistEntry[]> {
  const p = path.join(corpusDir, "goldens", "entities.yaml");
  return parseYaml(readFileSync(p, "utf8")) as Record<string, AllowlistEntry[]>;
}

/** The file each block-based entity type lives in. */
const TYPE_FILE: Record<string, string> = {
  stakeholders: "stakeholders.md",
  incentives: "incentives.md",
  decisions: "decisions.md",
  requirements: "requirements.md",
  tensions: "tensions.md",
  scope: "scope.md",
};

/** Candidate pools per entity type, from the parsed brain + blocks. */
export function candidatesFor(
  type: EntityType,
  brain: Brain,
  blocks: EntityBlock[],
): { id: string; fields: Record<string, unknown>; file: string; text: string }[] {
  if (type === "projects") {
    return brain.projects
      .filter((p) => p.charter)
      .map((p) => ({
        id: p.charter!.id,
        fields: p.charter! as unknown as Record<string, unknown>,
        file: `projects/${p.slug}/project.md`,
        text: `${p.charter!.id} ${p.charter!.name ?? ""}`.toLowerCase(),
      }));
  }
  if (type === "drops") {
    return brain.drops.map((d) => ({
      id: d.id,
      fields: d as unknown as Record<string, unknown>,
      file: d.path,
      text: `${d.id} ${d.title ?? ""}`.toLowerCase(),
    }));
  }
  if (type === "logs") {
    return brain.projects.flatMap((p) =>
      p.log.map((l, i) => ({
        id: `${p.slug}/log[${i}]`,
        fields: l as unknown as Record<string, unknown>,
        file: `projects/${p.slug}/log.md`,
        text: `${l.title} ${l.kind}`.toLowerCase(),
      })),
    );
  }
  const fileName = TYPE_FILE[type];
  return blocks
    .filter((b) => path.basename(b.file) === fileName)
    .map((b) => ({
      id: b.id,
      fields: b.fields,
      file: b.file,
      text: `${b.id} ${b.displayName}`.toLowerCase(),
      prose: b.prose.toLowerCase(),
    }))
    .map((c) => c as { id: string; fields: Record<string, unknown>; file: string; text: string });
}

export interface Resolution {
  ok: boolean;
  id?: string;
  fields?: Record<string, unknown>;
  /** ok=false reasons */
  miss?: "none" | "ambiguous";
  candidates?: string[];
}

function asDateString(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v ?? "");
}

/** Resolve one matcher against a candidate pool. */
export function resolveMatcher(
  m: Matcher,
  pool: { id: string; fields: Record<string, unknown>; file: string; text: string; prose?: string }[],
): Resolution {
  let cands = pool;
  if (m.id) cands = cands.filter((c) => c.id === m.id);
  if (m.file) cands = cands.filter((c) => c.file.includes(m.file!));
  if (m.project) cands = cands.filter((c) => c.file.includes(m.project!));
  if (m.date) cands = cands.filter((c) => asDateString(c.fields["date"]) === m.date);
  if (m.kind) cands = cands.filter((c) => String(c.fields["kind"]) === m.kind);
  if (m.keywords_any?.length) {
    const kws = m.keywords_any.map((k) => k.toLowerCase());
    const primary = cands.filter((c) => kws.some((k) => c.text.includes(k)));
    // Fall back to prose matching only when id+displayName found nothing.
    cands = primary.length
      ? primary
      : cands.filter((c) => kws.some((k) => (c.prose ?? "").includes(k)));
  }
  if (cands.length === 1) return { ok: true, id: cands[0]!.id, fields: cands[0]!.fields };
  if (cands.length === 0) return { ok: false, miss: "none" };
  return { ok: false, miss: "ambiguous", candidates: cands.map((c) => c.id) };
}

/** Categorise an expect field for metric bucketing. */
export function fieldCategory(field: string): "attribution" | "supersession" | "general" {
  if (["stated_by", "decided_by", "between", "stakeholder", "involves"].includes(field))
    return "attribution";
  if (["supersedes", "superseded_by", "resolved_by"].includes(field)) return "supersession";
  return "general";
}

/** Evaluate a single expect value against an actual field value. */
export function evaluateExpect(
  expected: ExpectValue,
  actual: unknown,
  bindings: Map<string, string>,
): { pass: boolean; detail: string } {
  const norm = (v: unknown): unknown => (v instanceof Date ? asDateString(v) : v);
  const a = norm(actual);

  if (expected !== null && typeof expected === "object") {
    if ("one_of" in expected) {
      const pass = expected.one_of.map(norm).some((v) => v === a);
      return { pass, detail: `expected one of ${JSON.stringify(expected.one_of)}, got ${JSON.stringify(a)}` };
    }
    if ("includes" in expected) {
      const arr = Array.isArray(a) ? a.map(String) : [];
      const missing = expected.includes.filter((v) => !arr.includes(v));
      return {
        pass: missing.length === 0,
        detail: missing.length ? `missing ${JSON.stringify(missing)} in ${JSON.stringify(a)}` : "ok",
      };
    }
    if ("ref" in expected) {
      const bound = bindings.get(expected.ref);
      if (!bound) return { pass: false, detail: `ref ${expected.ref} did not resolve` };
      return { pass: a === bound, detail: `expected ${bound} (via ${expected.ref}), got ${JSON.stringify(a)}` };
    }
  }
  const pass = a === expected || String(a) === String(expected);
  return { pass, detail: pass ? "ok" : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(a)}` };
}
