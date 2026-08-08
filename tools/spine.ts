/**
 * Domain spine CLI — inspect packs and find what the spine is missing.
 *
 *   npx tsx tools/spine.ts validate [<domain>]     structural check (all packs if omitted)
 *   npx tsx tools/spine.ts list <domain>           facets + terms, extends merged
 *   npx tsx tools/spine.ts resolve <domain> "<phrase>"   free text → candidate terms
 *   npx tsx tools/spine.ts candidates [--clients-dir <dir>] [--min 2]
 *
 * `candidates` is the promotion report: free-form topics across all brains
 * ranked by how often and how widely they recur. Recurring bare topics are
 * evidence the spine is missing a term — see domains/README.md.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseAllBlocks, parseBrain } from "./lib/parser.js";
import {
  classifyTopic,
  listDomains,
  loadSpine,
  loadSpines,
  resolvePhrase,
  validateSpine,
} from "./lib/spine.js";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

function usage(): never {
  console.error(
    [
      "usage:",
      "  npx tsx tools/spine.ts validate [<domain>]",
      "  npx tsx tools/spine.ts list <domain>",
      '  npx tsx tools/spine.ts resolve <domain> "<phrase>"',
      "  npx tsx tools/spine.ts candidates [--min 2] [--clients-dir <dir>]",
    ].join("\n"),
  );
  process.exit(2);
}

if (cmd === "validate") {
  const targets = args[1] ? [args[1]] : listDomains();
  let failed = 0;
  for (const d of targets) {
    let errors: string[];
    try {
      errors = validateSpine(loadSpine(d));
    } catch (e) {
      errors = [`domains/${d}/spine.yaml: ${(e as Error).message}`];
    }
    if (errors.length) {
      failed++;
      for (const e of errors) console.log(`ERROR ${e}`);
    } else {
      console.log(`valid ✓ ${d}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (cmd === "list") {
  const domain = args[1];
  if (!domain) usage();
  const spine = loadSpine(domain);
  console.log(`${spine.label} (${spine.domain}) v${spine.version}${spine.extends ? ` extends ${spine.extends}` : ""}\n`);
  for (const f of spine.facets) {
    console.log(`${f.id} — ${f.label}`);
    for (const t of f.terms) {
      const alt = t.alt?.length ? `  (${t.alt.join(", ")})` : "";
      console.log(`  ${`${f.id}:${t.id}`.padEnd(34)} ${t.label}${alt}`);
    }
    console.log("");
  }
  process.exit(0);
}

if (cmd === "resolve") {
  const domain = args[1];
  const phrase = args.slice(2).filter((a) => !a.startsWith("--")).join(" ");
  if (!domain || !phrase) usage();
  const hits = resolvePhrase(phrase, [loadSpine(domain)]);
  if (has("json")) {
    console.log(JSON.stringify(hits, null, 2));
  } else if (!hits.length) {
    console.log("(no spine terms matched — this would be a free-form topic)");
  } else {
    for (const h of hits) console.log(`${h.topic.padEnd(34)} matched "${h.matched}"`);
  }
  process.exit(0);
}

if (cmd === "candidates") {
  const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
  const min = Number(opt("min") ?? "2");
  if (!existsSync(clientsDir)) {
    console.error(`no clients directory: ${clientsDir}`);
    process.exit(2);
  }
  const clients = readdirSync(clientsDir).filter(
    (n) => !n.startsWith(".") && !n.startsWith("_") && statSync(path.join(clientsDir, n)).isDirectory(),
  );

  interface Row { topic: string; count: number; clients: Set<string> }
  const free = new Map<string, Row>();
  const unresolved: { client: string; topic: string; id: string }[] = [];

  for (const client of clients) {
    const brain = parseBrain(clientsDir, client);
    const spines = loadSpines(brain.profile?.domains ?? []);
    for (const b of parseAllBlocks(clientsDir, client)) {
      const topics = b.fields["topics"];
      if (!Array.isArray(topics)) continue;
      for (const raw of topics) {
        const t = classifyTopic(String(raw), spines);
        if (t.form === "free") {
          const row = free.get(t.raw) ?? { topic: t.raw, count: 0, clients: new Set<string>() };
          row.count++;
          row.clients.add(client);
          free.set(t.raw, row);
        } else if (!t.resolved) {
          unresolved.push({ client, topic: t.raw, id: b.id });
        }
      }
    }
  }

  const rows = [...free.values()]
    .filter((r) => r.count >= min)
    .sort((a, b) => b.clients.size - a.clients.size || b.count - a.count);

  if (has("json")) {
    console.log(
      JSON.stringify(
        rows.map((r) => ({ topic: r.topic, count: r.count, clients: [...r.clients].sort() })),
        null,
        2,
      ),
    );
  } else {
    if (!rows.length) console.log(`(no free-form topic recurs at least ${min}×)`);
    for (const r of rows) {
      console.log(`${r.topic.padEnd(38)} ${String(r.count).padStart(3)}×  ${r.clients.size} client(s): ${[...r.clients].sort().join(", ")}`);
    }
    if (rows.length)
      console.log(
        `\nTopics recurring across clients are the strongest promotion candidates — ` +
          `use the brain-domain skill to add them to a pack.`,
      );
    for (const u of unresolved)
      console.log(`\nWARN ${u.client}: "${u.topic}" on ${u.id} looks controlled but resolves in no attached spine`);
  }
  process.exit(0);
}

usage();
