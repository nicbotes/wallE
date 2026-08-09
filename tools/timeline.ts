/**
 * The client's story in EVENT order — what happened when, regardless of when we
 * learned it. The counterpart to query-log.ts, which reports knowledge time
 * (git commit order). See "Two clocks" in schema/SCHEMA.md.
 *
 *   npx tsx tools/timeline.ts <client-slug> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                             [--project <proj-id>] [--topic <facet:term|slug>]
 *                             [--json] [--html <path>]
 *                             [--backfilled-only] [--clients-dir <dir>]
 *
 * Backfilled rows (event date materially earlier than the drop that taught us)
 * are marked, so it is always clear which parts of the history were
 * reconstructed after the fact.
 */

import { writeFileSync } from "node:fs";
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
  ["from", "to", "project", "clients-dir", "topic", "html"].map((n) => opt(n)).filter(Boolean) as string[],
);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!slug) {
  console.error(
    "usage: npx tsx tools/timeline.ts <client-slug> [--from d] [--to d] [--project p] " +
      "[--topic t] [--json] [--html <path>] [--backfilled-only]",
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
  topics: string[];
  /** For a decision that replaced an earlier one: that decision's id. */
  supersedes?: string;
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
  extra: { topics?: unknown; supersedes?: unknown } = {},
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
    topics: Array.isArray(extra.topics) ? extra.topics.map(String) : [],
    ...(extra.supersedes ? { supersedes: String(extra.supersedes) } : {}),
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
  const t = { topics: b.fields["topics"] };
  if (f === "decisions.md")
    push(b.fields["date"], "decision", b.id, b.displayName, b.fields["source"], proj, {
      ...t,
      supersedes: b.fields["supersedes"],
    });
  else if (f === "requirements.md")
    push(b.fields["date"], "requirement", b.id, b.displayName, b.fields["source"], proj, t);
  else if (f === "tensions.md") {
    push(b.fields["opened"], "tension-opened", b.id, b.displayName, b.fields["source"], proj, t);
    if (b.fields["resolved"])
      push(b.fields["resolved"], "tension-resolved", b.id, b.displayName, b.fields["source"], proj, t);
  } else if (f === "scope.md")
    push(b.fields["since"], "scope", b.id, b.displayName, b.fields["source"], proj, t);
}

for (const p of brain.projects) {
  if (p.charter?.started)
    push(p.charter.started, "project-started", p.charter.id, p.charter.name, undefined, p.slug);
  for (const l of p.log) push(l.date, `log:${l.kind}`, l.title, l.title, l.source, p.slug);
}

const from = opt("from");
const to = opt("to");
const project = opt("project");
const topic = opt("topic");

let out = rows
  .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
  .filter((r) => !project || r.project === project || r.project === project.replace(/^proj-/, ""))
  .filter((r) => !has("backfilled-only") || r.backfilled)
  // Topic filter keeps drops out unless they carry the tag themselves —
  // a drop has no topics, and including every drop would drown the thread.
  .filter((r) => !topic || r.topics.includes(topic))
  .sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : a.date.localeCompare(b.date)));

const htmlPath = opt("html");

if (htmlPath) {
  writeFileSync(path.resolve(htmlPath), renderHtml(out));
  console.error(`wrote ${out.length} events to ${htmlPath}`);
} else if (has("json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  if (!out.length) console.log("(no events)");
  for (const r of out) {
    const where = r.project ? ` [${r.project}]` : "";
    const mark = r.backfilled ? `  ← backfilled, learned ${r.learned} via ${r.source}` : "";
    console.log(`${r.date}  ${r.kind.padEnd(16)}${where} ${r.label}${mark}`);
  }
}


/**
 * A shareable, self-contained timeline. Deliberately zero dependencies and no
 * network references — inline CSS only — so the file opens from disk, survives
 * being emailed, and works in an environment that denies outbound requests.
 */
function renderHtml(events: Row[]): string {
  const esc = (v: unknown): string =>
    String(v ?? "").replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
  const byId = new Map(events.map((e) => [e.id, e]));
  const heading = [
    esc(brain.profile?.name ?? slug),
    topic ? `· ${esc(topic)}` : "",
    project ? `· ${esc(project)}` : "",
  ].filter(Boolean).join(" ");

  const items = events.map((e) => {
    const replaced = e.supersedes ? byId.get(e.supersedes) : undefined;
    const meta = [
      e.project ? `<span class="tag">${esc(e.project)}</span>` : "",
      ...e.topics.map((t) => `<span class="tag topic">${esc(t)}</span>`),
    ].join("");
    const notes = [
      replaced
        ? `<p class="note replaces">replaces <strong>${esc(replaced.label)}</strong> (${esc(replaced.date)})</p>`
        : e.supersedes
          ? `<p class="note replaces">replaces <code>${esc(e.supersedes)}</code></p>`
          : "",
      e.backfilled
        ? `<p class="note backfill">backfilled — we only learned this on ${esc(e.learned)}, via ${esc(e.source)}</p>`
        : "",
    ].join("");
    return `      <li class="ev ${esc(e.kind.split(":")[0])}${e.backfilled ? " is-backfill" : ""}">
        <time>${esc(e.date)}</time>
        <div class="body">
          <p class="label">${esc(e.label)}</p>
          <p class="kind">${esc(e.kind)}${meta}</p>
          ${notes}
        </div>
      </li>`;
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading} — timeline</title>
<style>
  :root {
    --bg: #fbfbfa; --fg: #1d1d1f; --muted: #6b6b70; --line: #d8d8d6;
    --accent: #4a7fb5; --warn: #c08a3e; --ok: #3f9e7c;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #16171a; --fg: #ececf0; --muted: #9b9ba3; --line: #33343a;
            --accent: #7bb0e0; --warn: #d9ab6a; --ok: #6cc4a1; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 2.5rem 1.25rem 4rem; background: var(--bg); color: var(--fg);
         font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
  .sub { color: var(--muted); margin: 0 0 2rem; font-size: .9rem; }
  ol { list-style: none; margin: 0; padding: 0 0 0 8.5rem; position: relative; }
  ol::before { content: ""; position: absolute; left: 7.6rem; top: .4rem; bottom: .4rem;
               width: 2px; background: var(--line); }
  .ev { position: relative; margin: 0 0 1.4rem; }
  .ev::before { content: ""; position: absolute; left: -1.05rem; top: .45rem; width: 9px; height: 9px;
                border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px var(--bg); }
  .ev.decision::before { background: var(--ok); }
  .ev.tension-opened::before { background: var(--warn); }
  .ev.tension-resolved::before { background: var(--ok); }
  .ev.drop::before { background: var(--line); }
  .ev.is-backfill::before { background: var(--bg); border: 2px dashed var(--warn); }
  time { position: absolute; left: -8.5rem; width: 6.5rem; text-align: right;
         color: var(--muted); font-variant-numeric: tabular-nums; font-size: .85rem; }
  .label { margin: 0; font-weight: 600; }
  .kind { margin: .1rem 0 0; color: var(--muted); font-size: .82rem; }
  .tag { display: inline-block; margin-left: .4rem; padding: .05rem .4rem; border: 1px solid var(--line);
         border-radius: 999px; font-size: .74rem; }
  .note { margin: .35rem 0 0; font-size: .84rem; }
  .replaces { color: var(--ok); }
  .backfill { color: var(--warn); }
  code { font-size: .82em; }
  footer { max-width: 760px; margin: 3rem auto 0; padding-top: 1rem; border-top: 1px solid var(--line);
           color: var(--muted); font-size: .8rem; }
</style></head>
<body><main>
  <h1>${heading}</h1>
  <p class="sub">${events.length} events in <strong>event order</strong> — when things happened, not when we learned them. Dashed markers are backfilled.</p>
  <ol>
${items.join("\n")}
  </ol>
</main>
<footer>Generated by tools/timeline.ts — internal view; use tools/client-view.ts for anything client-facing.</footer>
</body></html>
`;
}
