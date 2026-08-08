/**
 * Staleness report: entities whose last_confirmed is older than a cutoff.
 *
 *   npx tsx tools/staleness.ts <client-slug> [--months 6] [--clients-dir <dir>]
 *                              [--as-of YYYY-MM-DD]
 *
 * `--as-of` pins "now" (used by evals against simulated timelines).
 * Output: JSON array of { file, id, kind, last_confirmed, months_stale }.
 */

import path from "node:path";
import { parseBrain } from "./lib/parser.js";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
};
const slug = args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1]?.startsWith("--")));
if (!slug) {
  console.error("usage: npx tsx tools/staleness.ts <client-slug> [--months 6] [--as-of YYYY-MM-DD]");
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir", "clients")!);
const months = Number(opt("months", "6"));
const asOfStr = opt("as-of");
const asOf = asOfStr ? new Date(asOfStr) : new Date();

const brain = parseBrain(clientsDir, slug);

interface StaleRow {
  file: string;
  id: string;
  kind: string;
  last_confirmed: string;
  months_stale: number;
}

const rows: StaleRow[] = [];
const check = (file: string, id: string, kind: string, lastConfirmed: unknown) => {
  if (!lastConfirmed) return;
  const s =
    lastConfirmed instanceof Date
      ? lastConfirmed.toISOString().slice(0, 10)
      : String(lastConfirmed);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return;
  const monthsStale = (asOf.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (monthsStale >= months)
    rows.push({ file, id, kind, last_confirmed: s, months_stale: Math.round(monthsStale * 10) / 10 });
};

for (const s of brain.stakeholders)
  if (s.status === "active") check("stakeholders.md", s.id, "stakeholder", s.last_confirmed);
for (const i of brain.incentives) check("incentives.md", i.id, "incentive", i.last_confirmed);
for (const p of brain.projects)
  for (const r of p.requirements)
    if (r.status === "active")
      check(`projects/${p.slug}/requirements.md`, r.id, "requirement", r.last_confirmed);

rows.sort((a, b) => b.months_stale - a.months_stale);
console.log(JSON.stringify(rows, null, 2));
