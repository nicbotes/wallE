/**
 * Score reporting: eval/.runs/latest.json for the threshold test, and — on
 * --baseline — a committed eval/reports/YYYY-MM-DD-<sha>.{json,md} pair with
 * a delta against the previous committed baseline and a per-failure appendix.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Aggregate, DropScore } from "./metrics.js";

export interface RunReport {
  date: string;
  repoSha: string;
  skillhash: string;
  model: string;
  judgeModel: string | null;
  drops: string;
  aggregate: Aggregate;
  perDrop: Omit<DropScore, "deterministic" | "complianceDetail" | "judgeDetail">[];
  failures: {
    seq: number;
    kind: "assertion" | "compliance" | "judge" | "precision" | "parse";
    detail: string;
  }[];
}

const fmt = (x: number | null): string => (x === null ? "n/a" : x.toFixed(2));

export function buildReport(
  repoDir: string,
  scores: DropScore[],
  agg: Aggregate,
  opts: { model: string; judgeModel: string | null; dropsArg: string; skillhash: string },
): RunReport {
  let repoSha = "unknown";
  try {
    repoSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoDir,
      encoding: "utf8",
    }).trim();
  } catch {
    /* fine */
  }

  const failures: RunReport["failures"] = [];
  for (const s of scores) {
    for (const a of s.deterministic.assertions.filter((a) => !a.pass)) {
      failures.push({
        seq: s.seq,
        kind: a.goldenBug ? "precision" : "assertion",
        detail: `${a.type} ${a.matcher} :: ${a.field} — ${a.detail}`,
      });
    }
    for (const h of s.deterministic.precision.hallucinated) {
      failures.push({ seq: s.seq, kind: "precision", detail: `hallucinated ${h.type}: ${h.id}` });
    }
    for (const c of s.complianceDetail.checks.filter((c) => !c.pass)) {
      failures.push({ seq: s.seq, kind: "compliance", detail: `${c.name} — ${c.detail}` });
    }
    for (const j of s.judgeDetail.filter((j) => !j.pass)) {
      failures.push({ seq: s.seq, kind: "judge", detail: `${j.rubric.slice(0, 80)}… — ${j.reason}` });
    }
    for (const e of s.deterministic.parseErrors) {
      failures.push({ seq: s.seq, kind: "parse", detail: e });
    }
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    repoSha,
    skillhash: opts.skillhash,
    model: opts.model,
    judgeModel: opts.judgeModel,
    drops: opts.dropsArg,
    aggregate: agg,
    perDrop: scores.map(({ deterministic, complianceDetail, judgeDetail, ...rest }) => rest),
    failures,
  };
}

export function writeLatest(repoDir: string, report: RunReport): string {
  const dir = path.join(repoDir, "eval", ".runs");
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "latest.json");
  writeFileSync(p, JSON.stringify(report, null, 2));
  return p;
}

function previousBaseline(repoDir: string): RunReport | null {
  const dir = path.join(repoDir, "eval", "reports");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const last = files[files.length - 1];
  if (!last) return null;
  return JSON.parse(readFileSync(path.join(dir, last), "utf8")) as RunReport;
}

export function writeBaseline(repoDir: string, report: RunReport): { json: string; md: string } {
  const dir = path.join(repoDir, "eval", "reports");
  mkdirSync(dir, { recursive: true });
  const prev = previousBaseline(repoDir);
  const base = `${report.date}-${report.repoSha}`;
  const jsonPath = path.join(dir, `${base}.json`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const a = report.aggregate;
  const delta = (cur: number | null, old: number | null | undefined): string => {
    if (cur === null || old === null || old === undefined) return "";
    const d = cur - old;
    return d === 0 ? " (=)" : ` (${d > 0 ? "+" : ""}${d.toFixed(2)})`;
  };

  const lines = [
    `# Eval baseline — ${report.date} @ ${report.repoSha}`,
    "",
    `Model: \`${report.model}\` · judge: \`${report.judgeModel ?? "off"}\` · drops: ${report.drops} · skillhash: \`${report.skillhash}\``,
    `Cost: $${a.costUsd.toFixed(2)} · wall: ${a.wallMinutes.toFixed(1)} min` +
      (prev ? ` · delta vs ${prev.date}-${prev.repoSha}` : " · first baseline"),
    "",
    "| Metric | Score |",
    "| --- | --- |",
    `| Fact recall | ${fmt(a.recall)}${delta(a.recall, prev?.aggregate.recall)} |`,
    `| Precision | ${fmt(a.precision)}${delta(a.precision, prev?.aggregate.precision)} |`,
    `| Attribution | ${fmt(a.attribution)}${delta(a.attribution, prev?.aggregate.attribution)} |`,
    `| Supersession | ${fmt(a.supersession)}${delta(a.supersession, prev?.aggregate.supersession)} |`,
    `| Commit compliance | ${fmt(a.compliance)}${delta(a.compliance, prev?.aggregate.compliance)} |`,
    `| Judge | ${a.judge ? `${a.judge.passed}/${a.judge.total}` : "off"} |`,
    "",
    "## Per drop",
    "",
    "| # | Drop | Recall | Precision | Attrib | Supersede | Compliance | Judge | Commits | $ |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...report.perDrop.map(
      (d) =>
        `| ${d.seq} | ${d.drop.replace(/^drop-/, "")} | ${fmt(d.recall)} | ${fmt(d.precision)} | ${fmt(
          d.attribution,
        )} | ${fmt(d.supersession)} | ${fmt(d.compliance)} | ${
          d.judge ? `${d.judge.passed}/${d.judge.total}` : "—"
        } | ${d.commits} | ${d.costUsd.toFixed(2)} |`,
    ),
    "",
    "## Failures",
    "",
    ...(report.failures.length
      ? report.failures.map((f) => `- drop ${f.seq} [${f.kind}] ${f.detail}`)
      : ["None. 🎉"]),
    "",
  ];
  const mdPath = path.join(dir, `${base}.md`);
  writeFileSync(mdPath, lines.join("\n"));
  return { json: jsonPath, md: mdPath };
}

export function printSummary(report: RunReport): void {
  const a = report.aggregate;
  console.log("");
  console.log(`recall ${fmt(a.recall)} · precision ${fmt(a.precision)} · attribution ${fmt(a.attribution)} · supersession ${fmt(a.supersession)} · compliance ${fmt(a.compliance)}` + (a.judge ? ` · judge ${a.judge.passed}/${a.judge.total}` : ""));
  console.log(`cost $${a.costUsd.toFixed(2)} · ${a.wallMinutes.toFixed(1)} min · ${report.failures.length} failure(s)`);
  for (const f of report.failures.slice(0, 30)) {
    console.log(`  - drop ${f.seq} [${f.kind}] ${f.detail}`);
  }
  if (report.failures.length > 30) console.log(`  … and ${report.failures.length - 30} more (see report)`);
}
