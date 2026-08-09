/**
 * The client-safe projection of a brain.
 *
 *   npx tsx tools/client-view.ts <client-slug> [--json] [--project <proj-id>]
 *                                [--include-open-tensions] [--clients-dir <dir>]
 *
 * A brain deliberately holds material that must never reach a client: our read
 * on someone's disposition, inferred motives, who is blocking whom. That is
 * useful internally and career-damaging in a deck.
 *
 * The filter therefore lives HERE, in code, rather than as an instruction in a
 * skill. A prompt rule is a promise; a function that never emits the field is a
 * boundary. Anything client-facing consumes this tool's output and nothing
 * else — see .claude/skills/brain-brief/SKILL.md.
 *
 * INCLUDED — things the client said, decided, or can verify:
 *   decisions (incl. supersession chains) · requirements · scope · project
 *   charters and phase · delivery log · drop dates and titles · stakeholder
 *   names and roles
 *
 * EXCLUDED, always:
 *   disposition · influence · incentives (stated AND inferred) · observations ·
 *   confidence markers · `side: us` people · tension parties · our commentary
 *
 * Tensions are the subtle case: a resolved trade-off is legitimately part of
 * "why is it this way", so it is included but DEPERSONALISED — the issue and
 * its resolution, never "X vs Y". Open tensions are withheld unless explicitly
 * requested, since an unresolved internal disagreement is not the client's to
 * see by default.
 */

import path from "node:path";
import { parseAllBlocks, parseBrain } from "./lib/parser.js";
import type { Brain, EntityBlock } from "./lib/types.js";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set(
  ["clients-dir", "project"].map((n) => opt(n)).filter(Boolean) as string[],
);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!slug) {
  console.error(
    "usage: npx tsx tools/client-view.ts <client-slug> [--json] [--project <id>] [--include-open-tensions]",
  );
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const projectFilter = opt("project");
const includeOpenTensions = has("include-open-tensions");

const brain: Brain = parseBrain(clientsDir, slug);
const blocks = parseAllBlocks(clientsDir, slug);
const proseOf = (id: string): string => blocks.find((b) => b.id === id)?.prose ?? "";
const nameOf = (id: string): string =>
  blocks.find((b) => b.id === id)?.displayName ?? id;

const asDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "");

export interface ClientView {
  client: string;
  generated_from: { drops: number; through: string | null };
  people: { name: string; role: string }[];
  projects: {
    id: string;
    name: string;
    status: string;
    phase: string;
    scope: { in: string[]; out: string[]; undecided: string[] };
    requirements: { title: string; status: string; priority: string; date: string }[];
    decisions: ClientDecision[];
    log: { date: string; kind: string; title: string }[];
  }[];
  decisions: ClientDecision[];
  /** Resolved trade-offs, depersonalised. */
  resolved_questions: { question: string; opened: string; resolved: string; resolved_by: string | null }[];
  open_questions?: { question: string; opened: string }[];
  /** Prose passages a human should read before this goes to a client. */
  review_required: { where: string; signal: string; text: string }[];
}

interface ClientDecision {
  title: string;
  date: string;
  status: string;
  rationale: string;
  replaces: string | null;
  replaced_by: string | null;
}

/**
 * Only client-side people, and only their name and role. Departed people are
 * kept — their decisions still shape the engagement, and a name plus a role is
 * not sensitive.
 */
const people = brain.stakeholders
  .filter((s) => (s.side ?? "client") !== "us")
  .map((s) => ({ name: s.name, role: s.role }));

/**
 * Structured fields are filtered exhaustively; PROSE IS NOT. Decision rationale
 * is the most valuable thing in a client-facing story, so it is passed through
 * — but it is our own writing, and may carry framing that reads badly outside
 * the team ("won the argument", "sceptical", "pushed back").
 *
 * This flags passages worth a human read. It is a safety NET, not a filter:
 * it will miss things, so the rule remains that a human approves prose before
 * it reaches a client.
 */
const REVIEW_SIGNALS = [
  "sceptic", "skeptic", "champion", "blocker", "distrust", "wary", "resist",
  "won the argument", "pushed back", "refused", "reluctant", "politic",
  "incentive", "motivat", "agenda", "burned", "blame", "frustrat",
];

function flagProse(where: string, text: string): { where: string; signal: string; text: string }[] {
  const hits: { where: string; signal: string; text: string }[] = [];
  for (const line of text.split("\n").filter((l) => l.trim())) {
    const lower = line.toLowerCase();
    const signal = REVIEW_SIGNALS.find((s) => lower.includes(s));
    if (signal) hits.push({ where, signal, text: line.trim() });
  }
  return hits;
}

const reviewFlags: { where: string; signal: string; text: string }[] = [];

const decisionView = (d: {
  id: string;
  date: unknown;
  status: string;
  supersedes?: string | null;
  superseded_by?: string | null;
}): ClientDecision => {
  const rationale = proseOf(d.id);
  reviewFlags.push(...flagProse(`decision "${nameOf(d.id)}"`, rationale));
  return {
    title: nameOf(d.id),
    date: asDate(d.date),
    status: d.status,
    rationale,
    replaces: d.supersedes ? nameOf(d.supersedes) : null,
    replaced_by: d.superseded_by ? nameOf(d.superseded_by) : null,
  };
};

const projects = brain.projects
  .filter((p) => !projectFilter || p.charter?.id === projectFilter || p.slug === projectFilter)
  .map((p) => ({
    id: p.charter?.id ?? p.slug,
    name: p.charter?.name ?? p.slug,
    status: p.charter?.status ?? "unknown",
    phase: p.charter?.phase ?? "unknown",
    scope: {
      in: p.scope.filter((s) => s.state === "in").map((s) => nameOf(s.id)),
      out: p.scope.filter((s) => s.state === "out").map((s) => nameOf(s.id)),
      undecided: p.scope.filter((s) => s.state === "undecided").map((s) => nameOf(s.id)),
    },
    requirements: p.requirements.map((r) => ({
      title: nameOf(r.id),
      status: r.status,
      priority: r.priority,
      date: asDate(r.date),
    })),
    decisions: p.decisions.map(decisionView),
    log: p.log.map((l) => ({ date: asDate(l.date), kind: l.kind, title: l.title })),
  }));

// Tensions become depersonalised questions. `between` is never emitted.
const resolved = brain.tensions
  .filter((t) => t.status === "resolved")
  .map((t) => ({
    question: nameOf(t.id),
    opened: asDate(t.opened),
    resolved: asDate(t.resolved),
    resolved_by: t.resolved_by ? nameOf(t.resolved_by) : null,
  }));

const view: ClientView = {
  client: brain.profile?.name ?? slug,
  generated_from: {
    drops: brain.drops.length,
    through: brain.drops.length ? asDate(brain.drops[brain.drops.length - 1]!.date) : null,
  },
  people,
  projects,
  decisions: brain.decisions.map(decisionView),
  resolved_questions: resolved,
  ...(includeOpenTensions
    ? {
        open_questions: brain.tensions
          .filter((t) => t.status === "open")
          .map((t) => ({ question: nameOf(t.id), opened: asDate(t.opened) })),
      }
    : {}),
  review_required: reviewFlags,
};

if (has("json")) {
  console.log(JSON.stringify(view, null, 2));
} else {
  const out: string[] = [`# ${view.client} — status`, ""];
  out.push(
    `_Compiled from ${view.generated_from.drops} recorded conversations` +
      (view.generated_from.through ? `, through ${view.generated_from.through}` : "") +
      `._`,
    "",
  );

  if (view.people.length) {
    out.push("## People", "");
    for (const p of view.people) out.push(`- **${p.name}** — ${p.role}`);
    out.push("");
  }

  for (const p of view.projects) {
    out.push(`## ${p.name}`, "", `Status: **${p.status}** · phase: ${p.phase}`, "");
    if (p.scope.in.length) out.push("**In scope**", ...p.scope.in.map((s) => `- ${s}`), "");
    if (p.scope.undecided.length)
      out.push("**Undecided**", ...p.scope.undecided.map((s) => `- ${s}`), "");
    if (p.scope.out.length) out.push("**Out of scope**", ...p.scope.out.map((s) => `- ${s}`), "");
    if (p.requirements.length) {
      out.push("**Requirements**", "");
      for (const r of p.requirements) out.push(`- ${r.title} — ${r.priority}, ${r.status}`);
      out.push("");
    }
    if (p.decisions.length) {
      out.push("**Decisions**", "");
      for (const d of p.decisions) out.push(...decisionLines(d));
      out.push("");
    }
    if (p.log.length) {
      out.push("**Delivery log**", "");
      for (const l of p.log) out.push(`- ${l.date} — ${l.title} (${l.kind})`);
      out.push("");
    }
  }

  if (view.decisions.length) {
    out.push("## Organisation-level decisions", "");
    for (const d of view.decisions) out.push(...decisionLines(d));
    out.push("");
  }

  if (view.resolved_questions.length) {
    out.push("## Questions raised and settled", "");
    for (const q of view.resolved_questions) {
      out.push(
        `- **${q.question}** — raised ${q.opened}, settled ${q.resolved}` +
          (q.resolved_by ? ` by "${q.resolved_by}"` : ""),
      );
    }
    out.push("");
  }

  if (view.open_questions?.length) {
    out.push("## Open questions", "");
    for (const q of view.open_questions) out.push(`- **${q.question}** — open since ${q.opened}`);
    out.push("");
  }

  if (view.review_required.length) {
    out.push(
      "---",
      "",
      "> ⚠️ **Not client-ready as-is.** Structured fields are filtered; the prose",
      "> below is our own writing and may read badly outside the team. Review",
      "> before sending:",
      "",
    );
    for (const f of view.review_required)
      out.push(`> - ${f.where} — "${f.signal}": ${f.text}`);
    out.push("");
  }

  console.log(out.join("\n"));
}

function decisionLines(d: ClientDecision): string[] {
  const lines = [`- **${d.title}** (${d.date})`];
  if (d.replaces) lines.push(`  - replaced the earlier decision "${d.replaces}"`);
  if (d.replaced_by) lines.push(`  - later replaced by "${d.replaced_by}"`);
  const rationale = d.rationale.split("\n").filter(Boolean).join(" ").trim();
  if (rationale) lines.push(`  - ${rationale}`);
  return lines;
}
