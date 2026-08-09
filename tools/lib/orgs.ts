/**
 * Walking the value chain. Shared by `tools/org-chart.ts` (which draws it) and
 * `tools/client-view.ts` (which uses it to decide what one audience may see).
 *
 * Every function here is cycle-safe: `tools/validate.ts` rejects cyclic
 * `parent` links, but a brain is a human-edited file and these run on brains
 * that have not been validated yet.
 */

import type { Org } from "./types.js";

export const orgById = (orgs: Org[]): Map<string, Org> =>
  new Map(orgs.map((o) => [o.id, o]));

/** Direct children, in file order. */
export function childrenOf(orgs: Org[], id: string | null): Org[] {
  return orgs.filter((o) => (o.parent ?? null) === id);
}

/** Orgs with no parent, or whose parent does not resolve (so nothing is lost). */
export function rootsOf(orgs: Org[]): Org[] {
  const ids = new Set(orgs.map((o) => o.id));
  return orgs.filter((o) => !o.parent || !ids.has(o.parent));
}

/** From an org up to the top of its chain, nearest parent first. */
export function ancestorsOf(orgs: Org[], id: string): Org[] {
  const by = orgById(orgs);
  const out: Org[] = [];
  const seen = new Set<string>([id]);
  let cur = by.get(id)?.parent ?? null;
  while (cur && by.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    out.push(by.get(cur)!);
    cur = by.get(cur)!.parent ?? null;
  }
  return out;
}

/** Everything beneath an org, breadth-first. */
export function descendantsOf(orgs: Org[], id: string): Org[] {
  const out: Org[] = [];
  const seen = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: string[] = [];
    for (const parent of frontier) {
      for (const child of childrenOf(orgs, parent)) {
        if (seen.has(child.id)) continue;
        seen.add(child.id);
        out.push(child);
        next.push(child.id);
      }
    }
    frontier = next;
  }
  return out;
}

/**
 * An org's own line of the chain: those above it, itself, and those beneath.
 * Deliberately excludes siblings — a brand's line does not include the brand
 * next to it, and that exclusion is the whole point of audience scoping.
 */
export function lineOf(orgs: Org[], id: string): Org[] {
  const by = orgById(orgs);
  const self = by.get(id);
  if (!self) return [];
  return [...ancestorsOf(orgs, id).reverse(), self, ...descendantsOf(orgs, id)];
}
