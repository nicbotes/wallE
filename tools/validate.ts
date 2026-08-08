/**
 * Brain validator — enforces schema/SCHEMA.md mechanically.
 *
 *   npx tsx tools/validate.ts <client-slug> [--clients-dir <dir>]
 *
 * Exit 0 = valid; exit 1 = violations (printed one per line, "file: problem").
 * Warnings (unattributed requirements) don't fail the run but are printed.
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { parseBrain } from "./lib/parser.js";
import type { Brain } from "./lib/types.js";

const DISPOSITIONS = ["champion", "supportive", "neutral", "skeptical", "blocker", "unknown"];
const INFLUENCES = ["high", "medium", "low"];
const CONFIDENCES = ["high", "medium", "low"];
const DROP_TYPES = ["meeting", "workshop", "email", "slack", "incident", "update", "note"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateBrain(brain: Brain): ValidationResult {
  const errors: string[] = [...brain.parseErrors];
  const warnings: string[] = [];

  const shIds = new Set(brain.stakeholders.map((s) => s.id));
  const dropIds = new Set(brain.drops.map((d) => d.id));
  const decisionsEverywhere = [
    ...brain.decisions.map((d) => ({ d, file: "decisions.md" })),
    ...brain.projects.flatMap((p) =>
      p.decisions.map((d) => ({ d, file: `projects/${p.slug}/decisions.md` })),
    ),
  ];
  const decIds = new Set(decisionsEverywhere.map(({ d }) => d.id));
  const projIds = new Set(
    brain.projects.map((p) => p.charter?.id).filter((x): x is string => !!x),
  );

  const date = (v: unknown, where: string, field: string, required = true) => {
    if (v === null || v === undefined || v === "") {
      if (required) errors.push(`${where}: missing ${field}`);
      return;
    }
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    if (!DATE_RE.test(s)) errors.push(`${where}: ${field} "${s}" is not YYYY-MM-DD`);
  };
  const refSh = (v: unknown, where: string, field: string) => {
    if (v === null || v === undefined || v === "") return;
    if (!shIds.has(String(v))) errors.push(`${where}: ${field} "${v}" is not a known stakeholder`);
  };
  const refDrop = (v: unknown, where: string, field: string) => {
    if (v === null || v === undefined || v === "") {
      errors.push(`${where}: missing ${field}`);
      return;
    }
    if (v === "manual") return; // brain-init
    if (!dropIds.has(String(v))) errors.push(`${where}: ${field} "${v}" is not a known drop`);
  };
  const oneOf = (v: unknown, set: string[], where: string, field: string) => {
    if (!set.includes(String(v))) errors.push(`${where}: ${field} "${v}" not in [${set.join("|")}]`);
  };

  // --- profile ---------------------------------------------------------------
  if (!brain.profile) errors.push("client.md: missing or unparseable");
  else {
    if (brain.profile.id !== brain.slug)
      errors.push(`client.md: id "${brain.profile.id}" != directory slug "${brain.slug}"`);
    if (typeof brain.profile.schema_version !== "number")
      errors.push("client.md: schema_version missing or not a number");
  }

  // --- drops -----------------------------------------------------------------
  for (const d of brain.drops) {
    const where = d.path;
    if (!d.id?.startsWith("drop-")) errors.push(`${where}: id must start with drop-`);
    date(d.date, where, "date");
    oneOf(d.type, DROP_TYPES, where, "type");
    const expectedFile = `drops/${String(d.id).replace(/^drop-/, "")}.md`;
    if (d.id && d.path !== expectedFile)
      errors.push(`${where}: filename does not match id (expected ${expectedFile})`);
  }

  // --- stakeholders ----------------------------------------------------------
  for (const s of brain.stakeholders) {
    const where = `stakeholders.md (${s.id})`;
    if (!s.id?.startsWith("sh-")) errors.push(`${where}: id must start with sh-`);
    if (!s.name) errors.push(`${where}: missing name`);
    if (!s.role) errors.push(`${where}: missing role`);
    oneOf(s.status, ["active", "departed"], where, "status");
    oneOf(s.disposition, DISPOSITIONS, where, "disposition");
    oneOf(s.influence, INFLUENCES, where, "influence");
    refSh(s.reports_to, where, "reports_to");
    for (const p of s.projects ?? [])
      if (!projIds.has(p)) errors.push(`${where}: projects ref "${p}" is not a known project`);
    refDrop(s.first_seen, where, "first_seen");
    date(s.last_confirmed, where, "last_confirmed");
    for (const src of s.sources ?? []) refDrop(src, where, "sources");
  }

  // --- incentives ------------------------------------------------------------
  for (const i of brain.incentives) {
    const where = `incentives.md (${i.id})`;
    if (!i.id?.startsWith("inc-")) errors.push(`${where}: id must start with inc-`);
    refSh(i.stakeholder, where, "stakeholder");
    if (!i.stakeholder) errors.push(`${where}: missing stakeholder`);
    oneOf(i.kind, ["stated", "inferred"], where, "kind");
    oneOf(i.confidence, CONFIDENCES, where, "confidence");
    refDrop(i.source, where, "source");
    date(i.last_confirmed, where, "last_confirmed");
  }

  // --- decisions (org + project) ----------------------------------------------
  for (const { d, file } of decisionsEverywhere) {
    const where = `${file} (${d.id})`;
    if (!d.id?.startsWith("dec-")) errors.push(`${where}: id must start with dec-`);
    date(d.date, where, "date");
    oneOf(d.status, ["active", "superseded"], where, "status");
    if (!Array.isArray(d.decided_by)) errors.push(`${where}: decided_by must be a list`);
    else for (const sh of d.decided_by) refSh(sh, where, "decided_by");
    refDrop(d.source, where, "source");
    // supersession chain integrity
    if (d.supersedes) {
      if (!decIds.has(d.supersedes))
        errors.push(`${where}: supersedes "${d.supersedes}" is not a known decision`);
      else {
        const old = decisionsEverywhere.find(({ d: x }) => x.id === d.supersedes)!.d;
        if (old.superseded_by !== d.id)
          errors.push(`${where}: ${d.supersedes}.superseded_by should be "${d.id}" (found "${old.superseded_by}")`);
        if (old.status !== "superseded")
          errors.push(`${where}: ${d.supersedes} should have status superseded`);
      }
    }
    if (d.superseded_by) {
      if (d.status !== "superseded")
        errors.push(`${where}: has superseded_by but status is "${d.status}"`);
      if (!decIds.has(d.superseded_by))
        errors.push(`${where}: superseded_by "${d.superseded_by}" is not a known decision`);
      else {
        const successor = decisionsEverywhere.find(({ d: x }) => x.id === d.superseded_by)!.d;
        if (successor.supersedes !== d.id)
          errors.push(`${where}: ${d.superseded_by}.supersedes should be "${d.id}"`);
      }
    }
    if (d.status === "superseded" && !d.superseded_by)
      errors.push(`${where}: status superseded but no superseded_by`);
  }

  // --- tensions ----------------------------------------------------------------
  for (const t of brain.tensions) {
    const where = `tensions.md (${t.id})`;
    if (!t.id?.startsWith("ten-")) errors.push(`${where}: id must start with ten-`);
    oneOf(t.status, ["open", "resolved"], where, "status");
    if (!Array.isArray(t.between) || t.between.length === 0)
      errors.push(`${where}: between must be a non-empty list`);
    else for (const sh of t.between) refSh(sh, where, "between");
    date(t.opened, where, "opened");
    refDrop(t.source, where, "source");
    if (t.status === "resolved") {
      date(t.resolved, where, "resolved");
      if (t.resolved_by && !decIds.has(t.resolved_by))
        errors.push(`${where}: resolved_by "${t.resolved_by}" is not a known decision`);
    } else if (t.resolved || t.resolved_by) {
      errors.push(`${where}: open tension must not set resolved/resolved_by`);
    }
  }

  // --- projects ------------------------------------------------------------------
  for (const p of brain.projects) {
    const base = `projects/${p.slug}`;
    if (!p.charter) errors.push(`${base}/project.md: missing or unparseable`);
    else {
      const where = `${base}/project.md`;
      if (!p.charter.id?.startsWith("proj-")) errors.push(`${where}: id must start with proj-`);
      oneOf(p.charter.status, ["active", "paused", "delivered", "killed"], where, "status");
      if (!p.charter.phase) errors.push(`${where}: missing phase`);
    }

    for (const s of p.scope) {
      const where = `${base}/scope.md (${s.id})`;
      if (!s.id?.startsWith("scp-")) errors.push(`${where}: id must start with scp-`);
      oneOf(s.state, ["in", "out", "undecided"], where, "state");
      if (!["in", "out", "undecided"].includes(s.section))
        errors.push(`${where}: sits outside the In/Out/Undecided sections`);
      else if (s.state !== s.section)
        errors.push(`${where}: state "${s.state}" but sits under section "## ${s.section}"`);
      date(s.since, where, "since");
      for (const sh of s.decided_by ?? []) refSh(sh, where, "decided_by");
      refDrop(s.source, where, "source");
    }

    for (const r of p.requirements) {
      const where = `${base}/requirements.md (${r.id})`;
      if (!r.id?.startsWith("req-")) errors.push(`${where}: id must start with req-`);
      if (!r.stated_by) errors.push(`${where}: missing stated_by`);
      else if (r.stated_by === "unattributed")
        warnings.push(`${where}: unattributed requirement — gap to close`);
      else refSh(r.stated_by, where, "stated_by");
      date(r.date, where, "date");
      oneOf(r.status, ["active", "delivered", "dropped", "superseded"], where, "status");
      oneOf(r.priority, ["must", "should", "could", "unknown"], where, "priority");
      refDrop(r.source, where, "source");
      date(r.last_confirmed, where, "last_confirmed");
    }

    for (const l of p.log) {
      const where = `${base}/log.md (${l.title})`;
      oneOf(l.kind, ["update", "incident", "milestone"], where, "kind");
      date(l.date, where, "date");
      refDrop(l.source, where, "source");
      for (const sh of l.involves ?? []) refSh(sh, where, "involves");
    }
  }

  // --- duplicate ids across the whole brain -----------------------------------
  const allIds = [
    ...brain.stakeholders.map((x) => x.id),
    ...brain.incentives.map((x) => x.id),
    ...brain.tensions.map((x) => x.id),
    ...decisionsEverywhere.map(({ d }) => d.id),
    ...brain.projects.flatMap((p) => [
      ...p.scope.map((x) => x.id),
      ...p.requirements.map((x) => x.id),
    ]),
    ...brain.drops.map((x) => x.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) errors.push(`duplicate id: ${id}`);
    seen.add(id);
  }

  return { errors, warnings };
}

// --- CLI ---------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]).endsWith("validate.ts");
if (isMain) {
  const args = process.argv.slice(2);
  const dirFlag = args.indexOf("--clients-dir");
  const clientsDir =
    dirFlag !== -1 ? path.resolve(args[dirFlag + 1] ?? "clients") : path.resolve("clients");
  const slug = args.find((a) => !a.startsWith("--") && a !== args[dirFlag + 1]);
  if (!slug) {
    console.error("usage: npx tsx tools/validate.ts <client-slug> [--clients-dir <dir>]");
    process.exit(2);
  }
  if (!existsSync(path.join(clientsDir, slug))) {
    console.error(`no such client: ${path.join(clientsDir, slug)}`);
    process.exit(2);
  }
  const result = validateBrain(parseBrain(clientsDir, slug));
  for (const w of result.warnings) console.log(`WARN  ${w}`);
  for (const e of result.errors) console.log(`ERROR ${e}`);
  if (result.errors.length) {
    console.log(`\n${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
    process.exit(1);
  }
  console.log(`valid ✓ (${result.warnings.length} warning(s))`);
}
