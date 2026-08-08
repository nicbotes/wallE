/**
 * Speaker labels in a drop, and whether each already resolves to a stakeholder.
 *
 *   npx tsx tools/speakers.ts <client-slug> [<drop-id-or-path>] [--json]
 *                             [--unmapped] [--clients-dir <dir>]
 *
 * Meeting tools emit whatever the calendar/Zoom account was called — "Ada",
 * "Ada V. (Acme)", an email address, sometimes a room name. This lists every
 * distinct label with its share of the conversation and maps it against
 * stakeholder `name`/`aliases`, so an ingest can resolve everyone up front
 * instead of discovering an unmapped speaker halfway through.
 *
 * With no drop id, reports across every drop in the client (useful for
 * spotting a person who has been speaking under a label nobody mapped).
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseBrain } from "./lib/parser.js";
import type { Stakeholder } from "./lib/types.js";

/** `Name: 00:12` or `Name:` at line start — the common transcript shapes. */
const SPEAKER_RE = /^([^\n:]{1,60}?):(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/;
/** Inline form: `Name: said something`. */
const INLINE_RE = /^([^\n:]{1,60}?):\s+(\S.*)$/;

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set([opt("clients-dir")].filter(Boolean) as string[]);
const positional = args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
const slug = positional[0];
const dropArg = positional[1];

if (!slug) {
  console.error(
    "usage: npx tsx tools/speakers.ts <client-slug> [<drop-id>] [--json] [--unmapped]",
  );
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const brain = parseBrain(clientsDir, slug);

/** lowercased label → stakeholder */
const byLabel = new Map<string, Stakeholder>();
for (const s of brain.stakeholders) {
  const labels = [s.name, ...(s.aliases ?? [])];
  for (const l of labels) {
    if (l) byLabel.set(String(l).trim().toLowerCase(), s);
  }
}

interface SpeakerRow {
  label: string;
  turns: number;
  words: number;
  drops: string[];
  stakeholder: string | null;
  side: string | null;
}

const rows = new Map<string, SpeakerRow>();

function scan(dropId: string, body: string): void {
  const lines = body.split("\n");
  let current: string | null = null;
  const bump = (label: string, words: number) => {
    const key = label.trim();
    if (!key) return;
    const existing = rows.get(key.toLowerCase());
    if (existing) {
      existing.words += words;
      if (!existing.drops.includes(dropId)) existing.drops.push(dropId);
      return;
    }
    const sh = byLabel.get(key.toLowerCase()) ?? null;
    rows.set(key.toLowerCase(), {
      label: key,
      turns: 0,
      words,
      drops: [dropId],
      stakeholder: sh?.id ?? null,
      side: sh ? (sh.side ?? "client") : null,
    });
  };

  for (const line of lines) {
    const solo = line.match(SPEAKER_RE);
    if (solo) {
      current = (solo[1] ?? "").trim();
      bump(current, 0);
      rows.get(current.toLowerCase())!.turns++;
      continue;
    }
    const inline = line.match(INLINE_RE);
    if (inline && /^[A-Z(\[]/.test(inline[1] ?? "")) {
      const label = (inline[1] ?? "").trim();
      bump(label, (inline[2] ?? "").split(/\s+/).length);
      rows.get(label.toLowerCase())!.turns++;
      current = label;
      continue;
    }
    if (current && line.trim()) {
      const r = rows.get(current.toLowerCase());
      if (r) r.words += line.trim().split(/\s+/).length;
    }
  }
}

const dropsDir = path.join(clientsDir, slug, "drops");
let targets: { id: string; file: string }[] = [];
if (dropArg) {
  const match = brain.drops.find(
    (d) => d.id === dropArg || d.path === dropArg || path.basename(d.path) === dropArg,
  );
  if (!match) {
    console.error(`no such drop in ${slug}: ${dropArg}`);
    process.exit(2);
  }
  targets = [{ id: match.id, file: path.join(clientsDir, slug, match.path) }];
} else if (existsSync(dropsDir)) {
  targets = readdirSync(dropsDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const d = brain.drops.find((x) => path.basename(x.path) === f);
      return { id: d?.id ?? f, file: path.join(dropsDir, f) };
    });
}

for (const t of targets) {
  const raw = readFileSync(t.file, "utf8");
  scan(t.id, raw.replace(/^---\n[\s\S]*?\n---\n?/, ""));
}

let out = [...rows.values()].sort((a, b) => b.words - a.words);
if (has("unmapped")) out = out.filter((r) => !r.stakeholder);

if (has("json")) {
  console.log(JSON.stringify(out, null, 2));
} else if (!out.length) {
  console.log("(no speaker labels found)");
} else {
  const unmapped = out.filter((r) => !r.stakeholder).length;
  for (const r of out) {
    const who = r.stakeholder ? `${r.stakeholder} [${r.side}]` : "UNMAPPED";
    console.log(`${r.label.padEnd(28)} ${String(r.turns).padStart(3)} turns  ${String(r.words).padStart(5)} words  ${who}`);
  }
  if (unmapped)
    console.log(
      `\n${unmapped} unmapped label(s) — add each to an existing stakeholder's ` +
        `aliases, or create the stakeholder (set side: us for our own people).`,
    );
}
