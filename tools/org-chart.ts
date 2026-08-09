/**
 * The engagement's value chain, drawn.
 *
 *   npx tsx tools/org-chart.ts <client-slug> [--json] [--clients-dir <dir>]
 *
 * A chain — capacity provider above the partner we contract with, distribution
 * brands below it — is close to unreadable as raw YAML spread across a file.
 * This prints who sits where, who we contract with, which way authority flows,
 * and who we actually know at each organisation.
 *
 * Read-only. It draws what `orgs.md` says; `tools/validate.ts` is what says
 * whether `orgs.md` is coherent.
 */

import path from "node:path";
import { parseBrain } from "./lib/parser.js";
import { childrenOf, rootsOf } from "./lib/orgs.js";
import type { Brain, Org, Stakeholder } from "./lib/types.js";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set([opt("clients-dir")].filter(Boolean) as string[]);
const slug = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!slug) {
  console.error("usage: npx tsx tools/org-chart.ts <client-slug> [--json] [--clients-dir <dir>]");
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const brain: Brain = parseBrain(clientsDir, slug);

/** Which way authority runs, spelled out — the reason `tier` exists at all. */
const TIER_NOTE: Record<string, string> = {
  us: "our own team",
  principal: "our counterparty",
  upstream: "authority flows down from them",
  downstream: "we serve them through the chain",
  peer: "alongside us, no authority either way",
};

interface Node {
  id: string;
  name: string;
  tier: string;
  role: string;
  status: string;
  people: { id: string; name: string; role: string }[];
  /** Decisions this organisation had the right to make. */
  authority_over: string[];
  children: Node[];
}

const peopleAt = (org: string): Stakeholder[] =>
  brain.stakeholders.filter((s) => s.org === org);

const decisionsEverywhere = [
  ...brain.decisions,
  ...brain.projects.flatMap((p) => p.decisions),
];

function node(o: Org, seen: Set<string>): Node {
  seen.add(o.id);
  return {
    id: o.id,
    name: o.name,
    tier: String(o.tier),
    role: o.role,
    status: o.status,
    people: peopleAt(o.id).map((s) => ({ id: s.id, name: s.name, role: s.role })),
    authority_over: decisionsEverywhere.filter((d) => d.authority === o.id).map((d) => d.id),
    children: childrenOf(brain.orgs, o.id)
      .filter((c) => !seen.has(c.id))
      .map((c) => node(c, seen)),
  };
}

const seen = new Set<string>();
const tree = rootsOf(brain.orgs).map((o) => node(o, seen));
// Anything a cycle stranded still gets printed rather than silently vanishing.
const orphans = brain.orgs.filter((o) => !seen.has(o.id)).map((o) => node(o, seen));
const chart = [...tree, ...orphans];

// No org, or an org that doesn't resolve — either way they appear nowhere in
// the tree above, and a person who silently vanishes from the chart is worse
// than one listed as unplaced.
const knownOrgs = new Set(brain.orgs.map((o) => o.id));
const unplaced = brain.stakeholders.filter((s) => !s.org || !knownOrgs.has(s.org));

if (has("json")) {
  console.log(
    JSON.stringify(
      {
        client: brain.profile?.name ?? slug,
        orgs: chart,
        unplaced_people: unplaced.map((s) => ({ id: s.id, name: s.name, role: s.role })),
      },
      null,
      2,
    ),
  );
} else if (!brain.orgs.length) {
  console.log(
    `# ${brain.profile?.name ?? slug}\n\n` +
      "No orgs.md entries — this brain models a single organisation.\n" +
      "Add organisations when the engagement spans a chain (see schema/SCHEMA.md).",
  );
} else {
  const out: string[] = [`# ${brain.profile?.name ?? slug} — value chain`, ""];

  const draw = (n: Node, depth: number): void => {
    const pad = "  ".repeat(depth);
    const note = TIER_NOTE[n.tier] ?? n.tier;
    const former = n.status === "former" ? " · **former**" : "";
    out.push(`${pad}- **${n.name}** — ${n.role} _(${n.tier}: ${note})_${former}`);
    for (const p of n.people) out.push(`${pad}  - ${p.name}, ${p.role}`);
    if (n.authority_over.length)
      out.push(`${pad}  - _decides:_ ${n.authority_over.join(", ")}`);
    for (const c of n.children) draw(c, depth + 1);
  };

  for (const n of chart) draw(n, 0);
  out.push("");

  if (unplaced.length) {
    out.push(
      "## Not yet placed in the chain",
      "",
      "These people have no `org`, or one that does not resolve, so " +
        "audience-scoped output withholds them:",
      "",
    );
    for (const s of unplaced) out.push(`- ${s.name}, ${s.role} (${s.id})`);
    out.push("");
  }

  console.log(out.join("\n"));
}
