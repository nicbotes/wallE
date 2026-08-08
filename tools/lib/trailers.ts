/** Parse and format the finding-commit trailers defined in schema/FINDINGS.md. */

import { execFileSync } from "node:child_process";

export const FINDING_TYPES = [
  "brain-init",
  "drop",
  "stakeholder-new",
  "stakeholder-update",
  "incentive-new",
  "incentive-update",
  "requirement-new",
  "requirement-update",
  "decision-new",
  "decision-superseded",
  "scope-move",
  "tension-opened",
  "tension-resolved",
  "project-new",
  "project-update",
  "log-entry",
  "confirm",
  "correction",
] as const;

export type FindingType = (typeof FINDING_TYPES)[number];

export interface FindingCommit {
  sha: string;
  subject: string;
  client?: string;
  project?: string;
  finding?: string;
  entity?: string;
  refs: string[];
  attributedTo?: string;
  source?: string;
  /** Files touched by the commit (populated when requested). */
  files?: string[];
}

const TRAILER_KEYS: Record<string, keyof FindingCommit | "refs"> = {
  client: "client",
  project: "project",
  finding: "finding",
  entity: "entity",
  refs: "refs",
  "attributed-to": "attributedTo",
  source: "source",
};

const SEP = "\x1f";
const REC = "\x1e";

/** Read finding commits from a git repo, newest first. */
export function readFindingCommits(
  repoDir: string,
  opts: { withFiles?: boolean; range?: string } = {},
): FindingCommit[] {
  const format = "%H%x1f%s%x1f%(trailers:only,unfold)%x1e";
  const args = ["log", `--format=${format}`];
  if (opts.range) args.push(opts.range);
  let out: string;
  try {
    out = execFileSync("git", args, { cwd: repoDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return [];
  }

  const commits: FindingCommit[] = [];
  for (const record of out.split(REC)) {
    const trimmed = record.replace(/^\n+/, "");
    if (!trimmed) continue;
    const [sha, subject, trailerBlock] = trimmed.split(SEP);
    if (!sha || subject === undefined) continue;
    const c: FindingCommit = { sha, subject, refs: [] };
    for (const line of (trailerBlock ?? "").split("\n")) {
      const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
      if (!m) continue;
      const key = (m[1] ?? "").toLowerCase();
      const value = (m[2] ?? "").trim();
      const field = TRAILER_KEYS[key];
      if (!field) continue;
      if (field === "refs") {
        c.refs = value.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        (c as unknown as Record<string, unknown>)[field] = value;
      }
    }
    commits.push(c);
  }

  if (opts.withFiles) {
    for (const c of commits) {
      try {
        const out2 = execFileSync(
          "git",
          ["show", "--name-only", "--format=", c.sha],
          { cwd: repoDir, encoding: "utf8" },
        );
        c.files = out2.split("\n").map((s) => s.trim()).filter(Boolean);
      } catch {
        c.files = [];
      }
    }
  }

  return commits;
}

/** Build a commit message per schema/FINDINGS.md. */
export function formatCommitMessage(opts: {
  findingType: FindingType;
  client: string;
  summary: string;
  body?: string;
  project?: string;
  entity: string;
  refs?: string[];
  attributedTo?: string;
  source: string;
}): string {
  const lines = [`${opts.findingType}(${opts.client}): ${opts.summary}`, ""];
  if (opts.body) lines.push(opts.body, "");
  lines.push(`Client: ${opts.client}`);
  if (opts.project) lines.push(`Project: ${opts.project}`);
  lines.push(`Finding: ${opts.findingType}`);
  lines.push(`Entity: ${opts.entity}`);
  if (opts.refs?.length) lines.push(`Refs: ${opts.refs.join(", ")}`);
  if (opts.attributedTo) lines.push(`Attributed-To: ${opts.attributedTo}`);
  lines.push(`Source: ${opts.source}`);
  return lines.join("\n");
}
