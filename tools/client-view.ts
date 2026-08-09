/**
 * The client-safe projection of a brain.
 *
 *   npx tsx tools/client-view.ts <client-slug> [--json] [--project <proj-id>]
 *                                [--audience <org-id>] [--include-open-tensions]
 *                                [--clients-dir <dir>]
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
 *
 * AUDIENCES. When the engagement spans a value chain (see orgs.md), "the
 * client" is not one reader. An organisation below our counterparty must not
 * be shown that counterparty's commercials or a rival's requirements.
 * `--audience <org-id>` scopes the view to one organisation, under a single
 * deliberately strict rule:
 *
 *   nothing is emitted unless it is explicitly attributable to that
 *   organisation — via a person who belongs to it, or a decision made under
 *   its authority.
 *
 * So an unattributed requirement, a scope item nobody is recorded as deciding,
 * or a decision taken elsewhere is WITHHELD. That under-shares, and it is the
 * right direction to fail in: a human can add what is missing after looking,
 * but cannot unsend what leaked. Every audience view reports how much it
 * withheld so the gap is visible rather than mistaken for completeness.
 *
 * Note what this rule does NOT try to infer: a decision made upstream that
 * binds a downstream organisation is not shown to them unless someone of
 * theirs was party to it. Bindingness is not derivable from tier, and
 * guessing it here would be guessing with a client's data.
 */

import path from "node:path";
import { parseAllBlocks, parseBrain } from "./lib/parser.js";
import { lineOf } from "./lib/orgs.js";
import type { Brain, EntityBlock } from "./lib/types.js";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set(
  ["clients-dir", "project", "audience"].map((n) => opt(n)).filter(Boolean) as string[],
);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!slug) {
  console.error(
    "usage: npx tsx tools/client-view.ts <client-slug> [--json] [--project <id>] " +
      "[--audience <org-id>] [--include-open-tensions]",
  );
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const projectFilter = opt("project");
const audienceId = opt("audience");
const includeOpenTensions = has("include-open-tensions");

const brain: Brain = parseBrain(clientsDir, slug);

const audienceOrg = audienceId ? brain.orgs.find((o) => o.id === audienceId) : undefined;
if (audienceId && !audienceOrg) {
  // Falling through to an unscoped view would hand one audience everyone
  // else's material because of a typo. Refuse instead.
  console.error(
    `no such organisation: ${audienceId}\n` +
      `known: ${brain.orgs.map((o) => o.id).join(", ") || "(none — this brain has no orgs.md)"}`,
  );
  process.exit(2);
}
const blocks = parseAllBlocks(clientsDir, slug);
const proseOf = (id: string): string => blocks.find((b) => b.id === id)?.prose ?? "";
const nameOf = (id: string): string =>
  blocks.find((b) => b.id === id)?.displayName ?? id;

const asDate = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "");

export interface ClientView {
  client: string;
  generated_from: { drops: number; through: string | null };
  /** Present only when --audience scoped the view to one organisation. */
  audience?: {
    org: string;
    name: string;
    role: string;
    /** Their own line of the chain: above them, themselves, below them. Never siblings. */
    chain: { name: string; role: string; relation: "above" | "self" | "below" }[];
    /** What this scoping removed, so a partial view is never read as complete. */
    withheld: Record<string, number>;
  };
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
  resolved_questions: {
    question: string;
    opened: string;
    resolved: string;
    resolved_by: string | null;
    /** What was argued, WITHOUT who argued it. */
    considerations: string[];
  }[];
  open_questions?: { question: string; opened: string; considerations: string[] }[];
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

/** Running tally of what audience scoping removed. */
const withheld: Record<string, number> = {};
const withhold = (what: string, n = 1): void => {
  if (n > 0) withheld[what] = (withheld[what] ?? 0) + n;
};

/**
 * Our own people, by either signal. `side: us` is the original marker; org
 * membership is the newer one, and the two can drift on a human-edited file
 * (the validator warns when they do). A leak here is one of ours appearing in
 * a client's deck, so this reads both rather than trusting either.
 */
const usOrgIds = new Set(brain.orgs.filter((o) => o.tier === "us").map((o) => o.id));
const isOurs = (s: { side?: string; org?: string }): boolean =>
  (s.side ?? "client") === "us" || (s.org !== undefined && usOrgIds.has(s.org));

const orgOf = new Map(brain.stakeholders.map((s) => [s.id, s.org]));
/** Under audience scoping, a person counts only if they belong to that org. */
const personInAudience = (shId: unknown): boolean =>
  !audienceOrg || orgOf.get(String(shId)) === audienceOrg.id;

/**
 * Only client-side people, and only their name and role. Departed people are
 * kept — their decisions still shape the engagement, and a name plus a role is
 * not sensitive.
 */
const allClientPeople = brain.stakeholders.filter((s) => !isOurs(s));
const people = allClientPeople
  .filter((s) => personInAudience(s.id))
  .map((s) => ({ name: s.name, role: s.role }));
withhold("people", allClientPeople.length - people.length);

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

/**
 * An audience sees a decision when it was theirs to make (`authority`) or one
 * of their people took it. Nothing else — see the note at the top of the file
 * about not inferring bindingness from tier.
 */
const decisionInAudience = (d: {
  authority?: string | null;
  decided_by?: string[];
}): boolean =>
  !audienceOrg ||
  d.authority === audienceOrg.id ||
  (d.decided_by ?? []).some(personInAudience);

const projects = brain.projects
  .filter((p) => !projectFilter || p.charter?.id === projectFilter || p.slug === projectFilter)
  .map((p) => {
    const scope = p.scope.filter((s) => (s.decided_by ?? []).some(personInAudience) || !audienceOrg);
    withhold("scope", p.scope.length - scope.length);
    const requirements = p.requirements.filter((r) => personInAudience(r.stated_by));
    withhold("requirements", p.requirements.length - requirements.length);
    const decisions = p.decisions.filter(decisionInAudience);
    withhold("decisions", p.decisions.length - decisions.length);
    const log = p.log.filter((l) => (l.involves ?? []).some(personInAudience) || !audienceOrg);
    withhold("log entries", p.log.length - log.length);

    return {
      id: p.charter?.id ?? p.slug,
      name: p.charter?.name ?? p.slug,
      status: p.charter?.status ?? "unknown",
      phase: p.charter?.phase ?? "unknown",
      scope: {
        in: scope.filter((s) => s.state === "in").map((s) => nameOf(s.id)),
        out: scope.filter((s) => s.state === "out").map((s) => nameOf(s.id)),
        undecided: scope.filter((s) => s.state === "undecided").map((s) => nameOf(s.id)),
      },
      requirements: requirements.map((r) => ({
        title: nameOf(r.id),
        status: r.status,
        priority: r.priority,
        date: asDate(r.date),
      })),
      decisions: decisions.map(decisionView),
      log: log.map((l) => ({ date: asDate(l.date), kind: l.kind, title: l.title })),
      empty: !scope.length && !requirements.length && !decisions.length && !log.length,
    };
  })
  // A project an audience has no stake in should not even be named to them.
  .filter((p) => {
    if (!audienceOrg || !p.empty) return true;
    withhold("projects");
    return false;
  })
  .map(({ empty: _empty, ...p }) => p);

/**
 * Tensions become depersonalised questions. `between` is never emitted, and
 * position summaries are emitted WITHOUT their stakeholder — the trade-off on
 * its merits, which is the useful half, minus the politics, which is not ours
 * to share. Summaries are prose, so they go through the same review flagger.
 */
const considerationsOf = (t: { id: string; positions?: { summary: string }[] }): string[] => {
  const summaries = (t.positions ?? []).map((p) => p.summary).filter(Boolean);
  for (const s of summaries) reviewFlags.push(...flagProse(`question "${nameOf(t.id)}"`, s));
  return summaries;
};

/**
 * A tension is only this audience's business when EVERY party is theirs. A
 * disagreement that crosses a company boundary is depersonalised here, but its
 * existence still tells one organisation that another was pushing back — so it
 * stays inside the organisation it happened in.
 */
const tensionInAudience = (t: { between?: string[] }): boolean =>
  !audienceOrg || ((t.between ?? []).length > 0 && (t.between ?? []).every(personInAudience));

const resolvedAll = brain.tensions.filter((t) => t.status === "resolved");
const resolved = resolvedAll
  .filter(tensionInAudience)
  .map((t) => ({
    question: nameOf(t.id),
    opened: asDate(t.opened),
    resolved: asDate(t.resolved),
    resolved_by: t.resolved_by ? nameOf(t.resolved_by) : null,
    considerations: considerationsOf(t),
  }));
withhold("resolved questions", resolvedAll.length - resolved.length);

const openAll = brain.tensions.filter((t) => t.status === "open");
const open = openAll.filter(tensionInAudience);
if (includeOpenTensions) withhold("open questions", openAll.length - open.length);

const orgDecisions = brain.decisions.filter(decisionInAudience);
withhold("decisions", brain.decisions.length - orgDecisions.length);

const line = audienceOrg ? lineOf(brain.orgs, audienceOrg.id) : [];
const selfIndex = line.findIndex((o) => o.id === audienceOrg?.id);
const relationLabel = (index: number): "above" | "self" | "below" =>
  index === selfIndex ? "self" : index < selfIndex ? "above" : "below";

const view: ClientView = {
  client: brain.profile?.name ?? slug,
  generated_from: {
    drops: brain.drops.length,
    through: brain.drops.length ? asDate(brain.drops[brain.drops.length - 1]!.date) : null,
  },
  ...(audienceOrg
    ? {
        audience: {
          org: audienceOrg.id,
          name: audienceOrg.name,
          role: audienceOrg.role,
          chain: line.map((o, i) => ({
            name: o.name,
            role: o.role,
            relation: relationLabel(i),
          })),
          withheld,
        },
      }
    : {}),
  people,
  projects,
  decisions: orgDecisions.map(decisionView),
  resolved_questions: resolved,
  ...(includeOpenTensions
    ? {
        open_questions: open.map((t) => ({
          question: nameOf(t.id),
          opened: asDate(t.opened),
          considerations: considerationsOf(t),
        })),
      }
    : {}),
  review_required: reviewFlags,
};

if (has("json")) {
  console.log(JSON.stringify(view, null, 2));
} else {
  const heading = view.audience ? `${view.client} — status for ${view.audience.name}` : `${view.client} — status`;
  const out: string[] = [`# ${heading}`, ""];
  out.push(
    `_Compiled from ${view.generated_from.drops} recorded conversations` +
      (view.generated_from.through ? `, through ${view.generated_from.through}` : "") +
      `._`,
    "",
  );

  if (view.audience) {
    out.push(`## Prepared for ${view.audience.name} (${view.audience.role})`, "");
    if (view.audience.chain.length > 1) {
      out.push("Your line of the engagement:", "");
      for (const c of view.audience.chain) {
        const mark = c.relation === "self" ? "**you**" : c.relation;
        out.push(`- ${c.name} — ${c.role} (${mark})`);
      }
      out.push("");
    }
    const w = Object.entries(view.audience.withheld).filter(([, n]) => n > 0);
    if (w.length) {
      out.push(
        "> Scoped to this organisation. Withheld as belonging to others, or not " +
          "attributed to anyone here: " +
          w.map(([k, n]) => `${k}: ${n}`).join(", ") +
          ". Check that nothing withheld was actually theirs to see.",
        "",
      );
    }
  }

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
      for (const c of q.considerations) out.push(`  - considered: ${c}`);
    }
    out.push("");
  }

  if (view.open_questions?.length) {
    out.push("## Open questions", "");
    for (const q of view.open_questions) {
      out.push(`- **${q.question}** — open since ${q.opened}`);
      for (const c of q.considerations) out.push(`  - considered: ${c}`);
    }
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
