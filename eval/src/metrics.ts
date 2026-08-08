/** Score shapes + aggregation across drops. */

import type { DeterministicResult } from "./grade/deterministic.js";
import type { ComplianceResult } from "./grade/gitlog.js";
import type { JudgeResult } from "./grade/judge.js";
import type { RunUsage } from "./runner.js";

export interface DropScore {
  seq: number;
  drop: string;
  recall: number;
  precision: number;
  attribution: number | null;
  supersession: number | null;
  compliance: number;
  judge: { passed: number; total: number } | null;
  commits: number;
  costUsd: number;
  durationMs: number;
  deterministic: DeterministicResult;
  complianceDetail: ComplianceResult;
  judgeDetail: JudgeResult[];
}

export interface Aggregate {
  recall: number;
  precision: number;
  attribution: number | null;
  supersession: number | null;
  compliance: number;
  judge: { passed: number; total: number } | null;
  costUsd: number;
  wallMinutes: number;
}

export function makeDropScore(
  seq: number,
  drop: string,
  det: DeterministicResult,
  comp: ComplianceResult,
  judge: JudgeResult[],
  usage: RunUsage,
): DropScore {
  return {
    seq,
    drop,
    recall: det.recall,
    precision: det.precision.precision,
    attribution: det.attribution,
    supersession: det.supersession,
    compliance: comp.compliance,
    judge: judge.length ? { passed: judge.filter((j) => j.pass).length, total: judge.length } : null,
    commits: comp.commits,
    costUsd: usage.costUsd,
    durationMs: usage.durationMs,
    deterministic: det,
    complianceDetail: comp,
    judgeDetail: judge,
  };
}

export function aggregate(drops: DropScore[]): Aggregate {
  const mean = (xs: (number | null)[]): number | null => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const judgeTotals = drops
    .map((d) => d.judge)
    .filter((j): j is { passed: number; total: number } => j !== null)
    .reduce(
      (acc, j) => ({ passed: acc.passed + j.passed, total: acc.total + j.total }),
      { passed: 0, total: 0 },
    );
  return {
    recall: mean(drops.map((d) => d.recall)) ?? 0,
    precision: mean(drops.map((d) => d.precision)) ?? 0,
    attribution: mean(drops.map((d) => d.attribution)),
    supersession: mean(drops.map((d) => d.supersession)),
    compliance: mean(drops.map((d) => d.compliance)) ?? 0,
    judge: judgeTotals.total ? judgeTotals : null,
    costUsd: drops.reduce((a, d) => a + d.costUsd, 0),
    wallMinutes: drops.reduce((a, d) => a + d.durationMs, 0) / 60_000,
  };
}
