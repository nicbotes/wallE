/**
 * Corpus vs projection size — how much raw material the brain has digested, and
 * how small the curated view stayed.
 *
 *   npx tsx tools/stats.ts [<client-slug>] [--json] [--clients-dir <dir>]
 *
 * The architectural claim this measures: the event log (`drops/`) grows without
 * bound, while the projection a consultant actually reads stays context-sized.
 * When "drops" tokens dwarf the context window but "brain" stays small, files +
 * git is still the right store — you just want a search/vector layer over
 * `drops/` (see tools/search.ts, tools/index.ts), never over the brain.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set([opt("clients-dir")].filter(Boolean) as string[]);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");

/** Rough but stable: ~0.75 words per token for English prose. */
const tokens = (words: number): number => Math.round(words / 0.75);

interface Measure {
  files: number;
  words: number;
  bytes: number;
}

const empty = (): Measure => ({ files: 0, words: 0, bytes: 0 });

function measureFile(p: string, into: Measure): void {
  const text = readFileSync(p, "utf8");
  into.files++;
  into.bytes += Buffer.byteLength(text);
  into.words += text.split(/\s+/).filter(Boolean).length;
}

function walk(dir: string, into: Measure, skip: (p: string) => boolean = () => false): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (skip(p)) continue;
    if (statSync(p).isDirectory()) walk(p, into, skip);
    else if (name.endsWith(".md")) measureFile(p, into);
  }
}

interface ClientStats {
  client: string;
  drops: Measure & { tokens: number };
  brain: Measure & { tokens: number };
  /** How many words of raw input each word of curated brain represents. */
  compression: number;
}

function statsFor(client: string): ClientStats {
  const root = path.join(clientsDir, client);
  const drops = empty();
  walk(path.join(root, "drops"), drops);
  const brain = empty();
  walk(root, brain, (p) => path.basename(p) === "drops" || path.basename(p) === "_template");
  return {
    client,
    drops: { ...drops, tokens: tokens(drops.words) },
    brain: { ...brain, tokens: tokens(brain.words) },
    compression: brain.words ? Math.round((drops.words / brain.words) * 10) / 10 : 0,
  };
}

const clients = slug
  ? [slug]
  : existsSync(clientsDir)
    ? readdirSync(clientsDir).filter(
        (n) => !n.startsWith(".") && !n.startsWith("_") && statSync(path.join(clientsDir, n)).isDirectory(),
      )
    : [];

if (!clients.length) {
  console.error(`no clients found in ${clientsDir}`);
  process.exit(2);
}

const all = clients.map(statsFor);

if (has("json")) {
  console.log(JSON.stringify(all, null, 2));
} else {
  for (const s of all) {
    console.log(`\n${s.client}`);
    console.log(
      `  drops  ${String(s.drops.files).padStart(4)} files  ${String(s.drops.words).padStart(8)} words  ~${String(s.drops.tokens).padStart(8)} tokens`,
    );
    console.log(
      `  brain  ${String(s.brain.files).padStart(4)} files  ${String(s.brain.words).padStart(8)} words  ~${String(s.brain.tokens).padStart(8)} tokens`,
    );
    if (s.compression)
      console.log(`  ${s.compression}× — each word of brain stands for ${s.compression} words of raw input`);
    if (s.brain.tokens > 100_000)
      console.log("  ! the projection itself is getting large — consider splitting by project");
    if (s.drops.tokens > 200_000)
      console.log("  ! drops exceed any context window — search/vector layer over drops/ is worth it");
  }
  console.log("");
}
