/**
 * Domain packs — loading, merging and resolving the thin controlled spine.
 * See domains/README.md for the concept.
 *
 * A topic string is one of two things, and the difference is load-bearing:
 *   "component:coverage"      controlled — must resolve against a spine
 *   "renewal-pricing-quirk"   free-form — always allowed, promotion candidate
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export interface SpineTerm {
  id: string;
  label: string;
  alt?: string[];
}

export interface SpineFacet {
  id: string;
  label: string;
  description?: string;
  terms: SpineTerm[];
}

export interface Spine {
  domain: string;
  label: string;
  version: number;
  extends?: string;
  facets: SpineFacet[];
}

/** A topic string classified against the attached spines. */
export interface TopicRef {
  raw: string;
  /** "controlled" = facet:term form; "free" = bare slug. */
  form: "controlled" | "free";
  facet?: string;
  term?: string;
  /** Controlled topics only: whether facet+term resolve in an attached spine. */
  resolved?: boolean;
}

export const DOMAINS_DIR = "domains";

export function domainsRoot(repoDir = process.cwd()): string {
  return path.join(repoDir, DOMAINS_DIR);
}

/**
 * Attachable packs. `_template` is scaffolding (placeholder ids) and is never
 * attachable; `_base` is, since an engagement may have no industry spine.
 */
export function listDomains(repoDir = process.cwd()): string[] {
  const root = domainsRoot(repoDir);
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((n) => n !== "_template")
    .filter((n) => statSync(path.join(root, n)).isDirectory())
    .filter((n) => existsSync(path.join(root, n, "spine.yaml")))
    .sort();
}

/** Load one pack, without resolving `extends`. */
export function loadSpineRaw(domain: string, repoDir = process.cwd()): Spine {
  const p = path.join(domainsRoot(repoDir), domain, "spine.yaml");
  if (!existsSync(p)) throw new Error(`no such domain pack: ${domain} (${p})`);
  return parseYaml(readFileSync(p, "utf8")) as Spine;
}

/**
 * Load a pack with `extends` merged in. The child wins on facet id collision;
 * inherited facets come first so base concerns read before domain specifics.
 */
export function loadSpine(domain: string, repoDir = process.cwd(), seen: string[] = []): Spine {
  if (seen.includes(domain)) throw new Error(`circular extends: ${[...seen, domain].join(" → ")}`);
  const spine = loadSpineRaw(domain, repoDir);
  if (!spine.extends) return spine;
  const parent = loadSpine(spine.extends, repoDir, [...seen, domain]);
  const childIds = new Set((spine.facets ?? []).map((f) => f.id));
  return {
    ...spine,
    facets: [...(parent.facets ?? []).filter((f) => !childIds.has(f.id)), ...(spine.facets ?? [])],
  };
}

/** Structural problems in a pack — returned, not thrown, so the CLI can list them. */
export function validateSpine(spine: Spine): string[] {
  const errors: string[] = [];
  const where = `domains/${spine.domain ?? "?"}/spine.yaml`;
  if (!spine.domain) errors.push(`${where}: missing domain`);
  if (!spine.label) errors.push(`${where}: missing label`);
  if (typeof spine.version !== "number") errors.push(`${where}: version must be a number`);
  if (!Array.isArray(spine.facets) || spine.facets.length === 0) {
    errors.push(`${where}: must define at least one facet`);
    return errors;
  }
  const facetIds = new Set<string>();
  for (const f of spine.facets) {
    if (!f.id) errors.push(`${where}: facet missing id`);
    if (facetIds.has(f.id)) errors.push(`${where}: duplicate facet id "${f.id}"`);
    facetIds.add(f.id);
    if (!f.label) errors.push(`${where}: facet "${f.id}" missing label`);
    if (!Array.isArray(f.terms) || f.terms.length === 0) {
      errors.push(`${where}: facet "${f.id}" has no terms`);
      continue;
    }
    const termIds = new Set<string>();
    for (const t of f.terms) {
      if (!t.id) errors.push(`${where}: facet "${f.id}" has a term with no id`);
      if (termIds.has(t.id)) errors.push(`${where}: duplicate term "${f.id}:${t.id}"`);
      termIds.add(t.id);
      if (!t.label) errors.push(`${where}: term "${f.id}:${t.id}" missing label`);
    }
  }
  return errors;
}

/**
 * All spines attached to a brain. Unknown or broken packs are skipped rather
 * than thrown — reporting tools sweep every client and must not die because
 * one brain names a pack that isn't installed. `validate.ts` reports that.
 */
export function loadSpines(domains: string[], repoDir = process.cwd()): Spine[] {
  const out: Spine[] = [];
  for (const d of domains) {
    try {
      out.push(loadSpine(d, repoDir));
    } catch {
      // reported by the validator, not here
    }
  }
  return out;
}

/** Does `facet:term` exist in any of these spines? */
export function hasTerm(spines: Spine[], facet: string, term: string): boolean {
  return spines.some((s) => s.facets.some((f) => f.id === facet && f.terms.some((t) => t.id === term)));
}

/** Classify a topic string. `resolved` is only meaningful for controlled ones. */
export function classifyTopic(raw: string, spines: Spine[]): TopicRef {
  const s = String(raw).trim();
  const idx = s.indexOf(":");
  if (idx === -1) return { raw: s, form: "free" };
  const facet = s.slice(0, idx).trim();
  const term = s.slice(idx + 1).trim();
  return { raw: s, form: "controlled", facet, term, resolved: hasTerm(spines, facet, term) };
}

/**
 * Free-text → candidate spine terms, matching label and `alt` synonyms.
 * Word-boundary matching so "cover" doesn't fire on "discovery".
 */
export function resolvePhrase(phrase: string, spines: Spine[]): { topic: string; matched: string }[] {
  const hay = ` ${phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const hits: { topic: string; matched: string }[] = [];
  for (const spine of spines) {
    for (const f of spine.facets) {
      for (const t of f.terms) {
        const labels = [t.label, t.id.replace(/-/g, " "), ...(t.alt ?? [])];
        for (const l of labels) {
          const needle = ` ${String(l).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
          if (needle.trim() && hay.includes(needle)) {
            const topic = `${f.id}:${t.id}`;
            if (!hits.some((h) => h.topic === topic)) hits.push({ topic, matched: String(l) });
            break;
          }
        }
      }
    }
  }
  return hits;
}
