/**
 * Detecting client and domain material in text that is about to leave the
 * building — an upstream issue, a bug report, a pasted repro.
 *
 * This repo is the capability shell and is public. The brains built with it are
 * neither. `tools/client-view.ts` guards the client-facing direction; this
 * guards the *upstream* one, on the same principle: a documented rule is a
 * promise, a function that reports what it found is a boundary.
 *
 * What it can catch is bounded by what it can see. Run where real brains live
 * and it compares against every name, alias and identifier in them. Run in a
 * clean checkout of the shell and it has no brains to compare against, so only
 * the vocabulary and shape rules apply — which is why `issue-check.ts` says so
 * loudly rather than reporting a comfortable zero.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseAllBlocks, parseBrain } from "./parser.js";

/**
 * Industry vocabulary that belongs in `domains/` and nowhere else. Shared with
 * the leakage lint in eval/tests/corpus-integrity.test.ts so the two can never
 * disagree about what counts. Kept tight and unambiguous — a term that fires on
 * ordinary English trains people to ignore the whole check.
 *
 * The word "insurance" is deliberately absent: it names a shipped domain pack.
 */
export const DOMAIN_JARGON = [
  "capacity provider",
  "managing agent",
  "distribution brand",
  "underwrit",
  "insurer",
  "policyholder",
  "reinsur",
];

export type Severity = "error" | "warning";

export interface Identifier {
  term: string;
  kind: string;
  severity: Severity;
}

export interface Leak {
  line: number;
  kind: string;
  term: string;
  severity: Severity;
  text: string;
}

/** Shapes that betray their origin regardless of which client they came from. */
const SHAPE_RULES: { kind: string; re: RegExp; severity: Severity }[] = [
  {
    kind: "email address",
    re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
    severity: "error",
  },
  {
    // "Ada Vance (00:14:02)", "[00:14] Ada:", "Speaker 2:" — pasted transcript.
    kind: "transcript line",
    re: /(\(\d{1,2}:\d{2}(:\d{2})?\)|\[\d{1,2}:\d{2}(:\d{2})?\]|^\s*Speaker\s+\d+\s*:)/gim,
    severity: "error",
  },
  {
    kind: "local filesystem path",
    re: /(\/Users\/[\w.-]+|\/home\/[\w.-]+|[A-Za-z]:\\Users\\[\w.-]+)/g,
    severity: "warning",
  },
  {
    // A drop id carries a date and a subject: "we met about X on this day".
    kind: "drop identifier",
    re: /\bdrop-\d{4}-\d{2}-\d{2}-[a-z0-9-]+\b/g,
    severity: "error",
  },
  {
    kind: "brain entity identifier",
    re: /\b(sh|dec|req|ten|scp|obs|inc|proj|org)-[a-z0-9][a-z0-9-]{2,}\b/g,
    severity: "warning",
  },
];

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every name, alias and identifier in the brains under `clientsDir`. These are
 * the exact-match half of the check and the reason to run it where the real
 * brains are.
 */
export function identifiersFromBrains(clientsDir: string): Identifier[] {
  if (!existsSync(clientsDir)) return [];
  const out: Identifier[] = [];
  const add = (term: unknown, kind: string, severity: Severity = "error") => {
    const t = String(term ?? "").trim();
    if (t.length >= 3) out.push({ term: t, kind, severity });
  };

  const slugs = readdirSync(clientsDir).filter(
    (n) => !n.startsWith(".") && !n.startsWith("_") && statSync(path.join(clientsDir, n)).isDirectory(),
  );

  for (const slug of slugs) {
    add(slug, "client slug");
    const brain = parseBrain(clientsDir, slug);
    add(brain.profile?.name, "client name");

    for (const o of brain.orgs) {
      add(o.name, "organisation");
      add(o.id, "organisation id");
    }
    for (const s of brain.stakeholders) {
      add(s.name, "person");
      add(s.id, "person id");
      for (const a of s.aliases ?? []) add(a, "person alias");
      // Surnames recur in prose without the full name attached. Warned rather
      // than errored: a four-letter token can be an innocent English word.
      for (const part of String(s.name ?? "").split(/\s+/))
        if (part.length >= 4) add(part, "name fragment", "warning");
    }
    for (const p of brain.projects) {
      add(p.charter?.name, "project");
      add(p.charter?.id, "project id");
      add(p.slug, "project slug");
    }
    for (const d of brain.drops) add(d.id, "drop id");
    // Entity display names are written by us and often quote the client.
    for (const b of parseAllBlocks(clientsDir, slug)) add(b.displayName, "entity title", "warning");
  }

  // Longest first, so "Ada Vance" is reported rather than the fragment "Vance".
  return out.sort((a, b) => b.term.length - a.term.length);
}

/**
 * Names that are already published in this repo, and therefore cannot leak:
 * the shipped fixture brains, plus the neutral vocabulary `schema/SCHEMA.md`
 * uses in its examples.
 *
 * This matters more than it looks. CONTRIBUTING.md tells contributors to
 * rebuild their repro on exactly these fixtures — so flagging them would
 * penalise the correct behaviour and teach people to ignore the checker, which
 * is worse than the narrow risk it accepts: a real client that happens to share
 * a fixture name would be under-flagged.
 */
export function publicIdentifiers(repoDir: string): Set<string> {
  const fixtures = path.join(repoDir, "tools", "__fixtures__", "clients");
  const set = new Set<string>(["acme-utilities", "acme group", "acme"]);
  for (const i of identifiersFromBrains(fixtures)) set.add(i.term.toLowerCase());
  return set;
}

/**
 * Scan draft text, returning one leak per matching line.
 *
 * `allow` suppresses identifier matches only. Domain vocabulary and the shape
 * rules (emails, transcript lines) are never allowlisted — being public is a
 * property of a *name*, not of an email address that happens to appear in one.
 */
export function scanDraft(
  text: string,
  identifiers: Identifier[],
  allow: Set<string> = new Set(),
): Leak[] {
  const lines = text.split("\n");
  const leaks: Leak[] = [];
  const seen = new Set<string>();

  const record = (line: number, kind: string, term: string, severity: Severity) => {
    const key = `${line}:${kind}:${term.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    leaks.push({ line, kind, term, severity, text: (lines[line - 1] ?? "").trim() });
  };

  const terms: Identifier[] = [
    ...identifiers.filter((i) => !allow.has(i.term.toLowerCase())),
    ...DOMAIN_JARGON.map((term) => ({ term, kind: "domain vocabulary", severity: "error" as const })),
  ];

  lines.forEach((raw, i) => {
    const line = i + 1;
    for (const { term, kind, severity } of terms) {
      // Word boundaries so "beta" doesn't fire inside "betamax"; the trailing
      // boundary is dropped for stems like "underwrit" that are prefixes.
      const stem = /[a-z]$/.test(term) && term.length < 10 && !term.includes(" ");
      const re = new RegExp(`\\b${escape(term)}${stem ? "" : "\\b"}`, "i");
      if (re.test(raw)) record(line, kind, term, severity);
    }
    for (const rule of SHAPE_RULES) {
      const re = new RegExp(rule.re.source, rule.re.flags.replace(/g/g, ""));
      const m = raw.match(re);
      if (m) record(line, rule.kind, m[0], rule.severity);
    }
  });

  return leaks.sort((a, b) => a.line - b.line);
}
