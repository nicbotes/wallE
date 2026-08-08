/**
 * Commit-protocol compliance grading: reads the finding commits produced for
 * one drop (the range since the previous drop's tag) and checks them against
 * schema/FINDINGS.md rules + the golden's min_findings.
 */

import { FINDING_TYPES, readFindingCommits } from "../../../tools/lib/trailers.js";
import type { CommitProtocolGolden } from "../goldens.js";

export interface ComplianceResult {
  checks: { name: string; pass: boolean; detail: string }[];
  compliance: number; // fraction of checks passed
  commits: number;
}

/** Finding commits allowed to touch more than one brain file. */
const MULTI_FILE_OK = new Set(["confirm", "correction", "brain-init", "project-new"]);

export function gradeCommits(
  sandboxDir: string,
  golden: CommitProtocolGolden,
  prevTag: string | null,
  validateExitOk: boolean,
): ComplianceResult {
  const range = prevTag ? `${prevTag}..HEAD` : undefined;
  // newest first; reverse to chronological. Only commits touching clients/**
  // are subject to the protocol — the sandbox base commit is infrastructure.
  const commits = readFindingCommits(sandboxDir, { withFiles: true, range })
    .reverse()
    .filter((c) => c.files?.some((f) => f.startsWith("clients/")));
  const findings = commits.filter((c) => c.finding !== undefined);
  const checks: { name: string; pass: boolean; detail: string }[] = [];
  const add = (name: string, pass: boolean, detail = "ok") => checks.push({ name, pass, detail });

  add(
    "has-finding-commits",
    findings.length > 0,
    findings.length ? `${findings.length} finding commits` : "no finding commits in range",
  );

  // Every commit in range must be a finding commit with mandatory trailers.
  const nonFinding = commits.filter((c) => c.finding === undefined);
  add(
    "all-commits-trailered",
    nonFinding.length === 0,
    nonFinding.length ? `untrailered: ${nonFinding.map((c) => c.sha.slice(0, 7)).join(", ")}` : "ok",
  );

  for (const c of findings) {
    const short = c.sha.slice(0, 7);
    const missing = (["client", "entity", "source"] as const).filter((k) => !c[k]);
    if (missing.length)
      add(`trailers:${short}`, false, `missing ${missing.join(",")} on "${c.subject}"`);
    if (!FINDING_TYPES.includes(c.finding as (typeof FINDING_TYPES)[number]))
      add(`type:${short}`, false, `unknown finding type "${c.finding}"`);
    // brain-init precedes any drop and carries Source: manual by spec.
    if (c.finding !== "brain-init" && c.source !== golden.source)
      add(`source:${short}`, false, `Source ${c.source} != drop ${golden.source}`);
    if (!MULTI_FILE_OK.has(c.finding!) && (c.files?.length ?? 0) > 1)
      add(`one-file:${short}`, false, `${c.finding} touches ${c.files!.length} files`);
  }

  // The drop commit must open the ingest (brain-init may precede it on a
  // brand-new client).
  const firstIngest = findings.find((c) => c.finding !== "brain-init");
  add(
    "drop-commit-first",
    firstIngest?.finding === "drop",
    firstIngest ? `first is ${firstIngest.finding}` : "no commits",
  );

  // At most one confirm batch per drop.
  const confirms = findings.filter((c) => c.finding === "confirm").length;
  add("confirm-batched", confirms <= 1, `${confirms} confirm commits`);

  // Golden minimum finding counts.
  const byType = new Map<string, number>();
  for (const c of findings) byType.set(c.finding!, (byType.get(c.finding!) ?? 0) + 1);
  for (const [type, min] of Object.entries(golden.min_findings)) {
    const got = byType.get(type) ?? 0;
    add(`min:${type}`, got >= min, `${got}/${min}`);
  }

  // Backfill marking: late-learned history must be flagged so brain-diff can
  // tell "something happened" from "we learned something old".
  if (golden.min_backfill !== undefined) {
    const got = findings.filter((c) => c.backfill).length;
    add("min:backfill", got >= golden.min_backfill, `${got}/${golden.min_backfill}`);
  }

  add("validator-clean", validateExitOk, validateExitOk ? "ok" : "validate.ts reported errors");

  return {
    checks,
    compliance: checks.length ? checks.filter((c) => c.pass).length / checks.length : 1,
    commits: findings.length,
  };
}
