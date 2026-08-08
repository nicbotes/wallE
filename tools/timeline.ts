/**
 * The client's story in EVENT order — what happened when, regardless of when we
 * learned it. The counterpart to query-log.ts, which reports knowledge time
 * (git commit order). See "Two clocks" in schema/SCHEMA.md.
 *
 *   npx tsx tools/timeline.ts <client-slug> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                             [--project <proj-id>] [--json]
 *                             [--backfilled-only] [--clients-dir <dir>]
 *
 * Backfilled rows (event date materially earlier than the drop that taught us)
 * are marked, so it is always clear which parts of the history were
 * reconstructed after the fact.
 */

import path from "node:path";
import { parseAllBlocks, parseBrain } from "./lib/parser.js";
import type { EntityBlock } from "./lib/types.js";

/** Days between event and the drop that taught us, beyond which we call it backfill. */
const BACKFILL_DAYS = 30;

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set(
  ["from", "to", "project", "clients-dir"].map((n) => opt(n)).filter(Boolean) as string[],
);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!slug) {
  console.error(
    "usage: npx tsx tools/timeline.ts <client-slug> [--from d] [--to d] [--project p] [--json] [--backfilled-only]",
  );
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const brain = parseBrain(clientsDir, slug);
const blocks = parseAllBlocks(clientsDir, slug);

const asDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "");

const dropDate = new Map<string, string>();
for (const d of brain.drops) if (d.id) dropDate.set(d.id, asDate(d.date));

interface Row {
  date: string;
  kind: string;
  id: string;
  label: string;
  project?: string;
  source?: string;
  learned?: string;
  backfilled: boolean;
}

const daysBetween = (a: string, b: string): number =>
  (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;

const rows: Row[] = [];

const push = (
  date: unknown,
  kind: string,
  id: string,
  label: string,
  source: unknown,
  project?: string,
): void => {
  const ev = asDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev)) return;
  const learned = source ? dropDate.get(String(source)) : undefined;
  rows.push({
    date: ev,
    kind,
    id,
    label,
    project,
    source: source ? String(source) : undefined,
    learned,
    backfilled: learned ? daysBetween(ev, learned) > BACKFILL_DAYS : false,
  });
};

/** Project a block belongs to, inferred from its path. */
const projectOf = (b: EntityBlock): string | undefined =>
  b.file.startsWith("projects/") ? b.file.split("/")[1] : undefined;

for (const d of brain.drops) {
  push(d.date, "drop", d.id, d.title ?? d.id, d.id);
}

for (const b of blocks) {
  const f = path.basename(b.file);
  const proj = projectOf(b);
  if (f === "decisions.md")
    push(b.fields["date"], "decision", b.id, b.displayName, b.fields["source"], proj);
  else if (f === "requirements.md")
    push(b.fields["date"], "requirement", b.id, b.displayName, b.fields["source"], proj);
  else if (f === "tensions.md") {
    push(b.fields["opened"], "tension-opened", b.id, b.displayName, b.fields["source"], proj);
    if (b.fields["resolved"])
      push(b.fields["resolved"], "tension-resolved", b.id, b.displayName, b.fields["source"], proj);
  } else if (f === "scope.md")
    push(b.fields["since"], "scope", b.id, b.displayName, b.fields["source"], proj);
}

for (const p of brain.projects) {
  if (p.charter?.started)
    push(p.charter.started, "project-started", p.charter.id, p.charter.name, undefined, p.slug);
  for (const l of p.log) push(l.date, `log:${l.kind}`, l.title, l.title, l.source, p.slug);
}

const from = opt("from");
const to = opt("to");
const project = opt("project");

let out = rows
  .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
  .filter((r) => !project || r.project === project || r.project === project.replace(/^proj-/, ""))
  .filter((r) => !has("backfilled-only") || r.backfilled)
  .sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date.localeCompare(b.date)));

if (has("json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  if (!out.length) console.log("(no events)");
  for (const r of out) {
    const where = r.project ? ` [${r.project}]` : "";
    const mark = r.backfilled ? `  ← backfilled, learned ${r.learned} via ${r.source}` : "";
    console.log(`${r.date}  ${r.kind.padEnd(16)}${where} ${r.label}${mark}`);
  }
}
