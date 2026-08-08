/**
 * Deterministic grading: resolve every golden matcher against the sandbox
 * brain, evaluate expects (with as/ref bindings), and run the precision check
 * against the entities.yaml allowlist.
 */

import { parseAllBlocks, parseBrain } from "../../../tools/lib/parser.js";
import type { Brain, EntityBlock } from "../../../tools/lib/types.js";
import {
  type Assertion,
  type EntityType,
  type Golden,
  type AllowlistEntry,
  candidatesFor,
  evaluateExpect,
  fieldCategory,
  resolveMatcher,
} from "../goldens.js";

export interface AssertionResult {
  type: EntityType;
  matcher: string;
  field: string; // "(exists)" for pure presence checks
  category: "attribution" | "supersession" | "general" | "presence";
  pass: boolean;
  detail: string;
  goldenBug?: boolean; // ambiguous matcher — fix the golden, don't blame the skill
}

export interface PrecisionResult {
  extracted: number;
  hallucinated: { type: string; id: string }[];
  precision: number; // 1 - hallucinated/extracted (1 if nothing extracted)
}

export interface DeterministicResult {
  assertions: AssertionResult[];
  recall: number;
  attribution: number | null;
  supersession: number | null;
  precision: PrecisionResult;
  parseErrors: string[];
}

const ENTITY_TYPES: EntityType[] = [
  "stakeholders", "projects", "incentives", "decisions",
  "requirements", "tensions", "scope", "logs", "drops",
];

const PRECISION_TYPES = [
  "stakeholders", "projects", "incentives", "decisions",
  "requirements", "tensions", "scope",
] as const;

export function gradeDeterministic(
  sandboxDir: string,
  slug: string,
  golden: Golden,
  allowlist: Record<string, AllowlistEntry[]>,
  seq: number,
): DeterministicResult {
  const clientsDir = `${sandboxDir}/clients`;
  const brain: Brain = parseBrain(clientsDir, slug);
  const blocks: EntityBlock[] = parseAllBlocks(clientsDir, slug);
  const results: AssertionResult[] = [];
  const bindings = new Map<string, string>();

  // Pass 1: resolve all matchers, record presence, bind as: vars.
  const resolved = new Map<Assertion, ReturnType<typeof resolveMatcher>>();
  for (const type of ENTITY_TYPES) {
    const assertions = golden.deterministic[type] ?? [];
    const pool = candidatesFor(type, brain, blocks);
    for (const a of assertions) {
      const r = resolveMatcher(a.match, pool);
      resolved.set(a, r);
      if (r.ok && a.as) bindings.set(a.as, r.id!);
      results.push({
        type,
        matcher: JSON.stringify(a.match),
        field: "(exists)",
        category: "presence",
        pass: r.ok,
        detail: r.ok
          ? `resolved to ${r.id}`
          : r.miss === "ambiguous"
            ? `AMBIGUOUS golden matcher — candidates: ${r.candidates!.join(", ")}`
            : "no matching entity",
        goldenBug: r.miss === "ambiguous",
      });
    }
  }

  // Pass 2: evaluate expects.
  for (const type of ENTITY_TYPES) {
    for (const a of golden.deterministic[type] ?? []) {
      if (!a.expect) continue;
      const r = resolved.get(a)!;
      for (const [field, expected] of Object.entries(a.expect)) {
        if (!r.ok) {
          results.push({
            type, matcher: JSON.stringify(a.match), field,
            category: fieldCategory(field), pass: false,
            detail: "entity not resolved",
          });
          continue;
        }
        const { pass, detail } = evaluateExpect(expected, r.fields![field], bindings);
        results.push({
          type, matcher: JSON.stringify(a.match), field,
          category: fieldCategory(field), pass, detail,
        });
      }
    }
  }

  // Precision: everything extracted must match an allowlist entry with from<=seq.
  const hallucinated: { type: string; id: string }[] = [];
  let extracted = 0;
  for (const type of PRECISION_TYPES) {
    const pool = candidatesFor(type, brain, blocks);
    const allowed = (allowlist[type] ?? []).filter((e) => e.from <= seq);
    for (const entity of pool) {
      extracted++;
      const legit = allowed.some((e) => {
        const r = resolveMatcher(e.match, [entity]);
        return r.ok;
      });
      if (!legit) hallucinated.push({ type, id: entity.id });
    }
  }

  const rate = (rs: AssertionResult[]): number | null =>
    rs.length ? rs.filter((r) => r.pass).length / rs.length : null;

  const gradable = results.filter((r) => !r.goldenBug);
  return {
    assertions: results,
    recall: rate(gradable) ?? 1,
    attribution: rate(gradable.filter((r) => r.category === "attribution")),
    supersession: rate(gradable.filter((r) => r.category === "supersession")),
    precision: {
      extracted,
      hallucinated,
      precision: extracted ? (extracted - hallucinated.length) / extracted : 1,
    },
    parseErrors: brain.parseErrors,
  };
}
