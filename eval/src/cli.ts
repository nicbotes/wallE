/**
 * Eval harness entrypoint.
 *
 *   npm run eval -- [--drops all|N|A-B] [--model <id>] [--judge on|off]
 *                   [--judge-model <id>] [--smoke] [--baseline]
 *                   [--stale-ok] [--keep-sandbox]
 *
 * --smoke     = drops 1,7,8 on haiku, judge off (cheap pre-commit check)
 * --baseline  = full-from-scratch run + committed report in eval/reports/
 * --drops N   (N>1) resumes from the cached after-(N-1) snapshot
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { loadAllowlist, loadGolden } from "./goldens.js";
import { gradeDeterministic } from "./grade/deterministic.js";
import { gradeCommits } from "./grade/gitlog.js";
import { judgeDrop } from "./grade/judge.js";
import { aggregate, makeDropScore, type DropScore } from "./metrics.js";
import { buildReport, printSummary, writeBaseline, writeLatest } from "./report.js";
import { ingestDrop, type DropSpec } from "./runner.js";
import {
  createSandbox,
  removeSandbox,
  restoreSnapshot,
  skillhash,
  snapshot,
  tagAfterDrop,
} from "./sandbox.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS = path.join(REPO, "eval", "corpus", "meridian-energy");

interface Manifest {
  client: { name: string; slug: string };
  drops: {
    seq: number;
    file: string;
    id: string;
    date: string;
    type: string;
    title: string;
    source_tool?: string;
  }[];
}

function arg(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
}
const has = (name: string): boolean => process.argv.includes(`--${name}`);

function parseDrops(spec: string, max: number): number[] {
  if (spec === "all") return Array.from({ length: max }, (_, i) => i + 1);
  const range = spec.match(/^(\d+)-(\d+)$/);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  }
  const n = Number(spec);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`bad --drops: ${spec}`);
  return [n];
}

async function main(): Promise<void> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("ANTHROPIC_API_KEY is required (see .env.example). Aborting.");
    process.exit(2);
  }

  const smoke = has("smoke");
  const manifest = parseYaml(readFileSync(path.join(CORPUS, "manifest.yaml"), "utf8")) as Manifest;
  const dropsArg = smoke ? "smoke(1,7,8)" : (arg("drops", "all") as string);
  const seqs = smoke ? [1, 7, 8] : parseDrops(dropsArg, manifest.drops.length);
  const model = arg("model", process.env["EVAL_MODEL"] ?? (smoke ? "claude-haiku-4-5-20251001" : "claude-sonnet-5"))!;
  const judgeOn = smoke ? false : (arg("judge", "off") === "on");
  const judgeModel = arg("judge-model", process.env["EVAL_JUDGE_MODEL"] ?? "claude-haiku-4-5-20251001")!;
  const hash = skillhash(REPO);
  const runId = `run-${Date.now()}`;

  // Sequential seqs required (state is cumulative).
  for (let i = 1; i < seqs.length; i++) {
    if (seqs[i]! !== seqs[i - 1]! + 1) throw new Error("--drops must be contiguous");
  }

  let sandboxDir: string;
  const first = seqs[0]!;
  if (first === 1) {
    sandboxDir = createSandbox(REPO, runId);
    console.log(`sandbox: ${sandboxDir} (skillhash ${hash})`);
  } else {
    const restored = restoreSnapshot(REPO, hash, first - 1, runId, has("stale-ok"));
    if (!restored) {
      console.error(
        `No cached snapshot for after-${String(first - 1).padStart(2, "0")} at skillhash ${hash}.\n` +
          `Run from drop 1, or pass --stale-ok to reuse a snapshot from an older skill version.`,
      );
      process.exit(2);
    }
    sandboxDir = restored;
    console.log(`sandbox: restored after-${first - 1} → ${sandboxDir}`);
  }

  const allowlist = loadAllowlist(CORPUS);
  const scores: DropScore[] = [];

  for (const seq of seqs) {
    const m = manifest.drops.find((d) => d.seq === seq)!;
    const spec: DropSpec = {
      seq,
      id: m.id,
      date: String(m.date),
      type: m.type,
      title: m.title,
      text: readFileSync(path.join(CORPUS, m.file), "utf8"),
      ...(m.source_tool ? { sourceTool: m.source_tool } : {}),
    };
    console.log(`\n[${seq}/${manifest.drops.length}] ingesting ${m.id} (${model})…`);
    const prevTag = seq > 1 ? `eval/after-${String(seq - 1).padStart(2, "0")}` : null;

    const usage = await ingestDrop(sandboxDir, manifest.client.name, spec, model, (l) =>
      console.log(l),
    );
    console.log(`  ${usage.turns} turns, $${usage.costUsd.toFixed(2)}, ${(usage.durationMs / 1000).toFixed(0)}s`);

    // Grade.
    let validateOk = true;
    try {
      execFileSync("npx", ["tsx", "tools/validate.ts", manifest.client.slug], {
        cwd: sandboxDir,
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch {
      validateOk = false;
    }
    const golden = loadGolden(CORPUS, seq);
    const det = gradeDeterministic(sandboxDir, manifest.client.slug, golden, allowlist, seq);
    const comp = gradeCommits(sandboxDir, golden.deterministic.commit_protocol!, prevTag, validateOk);
    const judged = judgeOn
      ? await judgeDrop(sandboxDir, manifest.client.slug, golden.judge ?? [], spec.text, judgeModel)
      : [];

    const score = makeDropScore(seq, m.id, det, comp, judged, usage);
    scores.push(score);
    console.log(
      `  recall ${score.recall.toFixed(2)} · precision ${score.precision.toFixed(2)} · compliance ${score.compliance.toFixed(2)}` +
        (score.judge ? ` · judge ${score.judge.passed}/${score.judge.total}` : ""),
    );

    tagAfterDrop(sandboxDir, seq);
    snapshot(REPO, sandboxDir, hash, seq);
  }

  const agg = aggregate(scores);
  const report = buildReport(REPO, scores, agg, {
    model,
    judgeModel: judgeOn ? judgeModel : null,
    dropsArg,
    skillhash: hash,
  });
  const latest = writeLatest(REPO, report);
  printSummary(report);
  console.log(`\nrun written to ${path.relative(REPO, latest)}`);

  if (has("baseline")) {
    const { md } = writeBaseline(REPO, report);
    console.log(`baseline report: ${path.relative(REPO, md)} (commit it)`);
  }
  if (!has("keep-sandbox")) removeSandbox(sandboxDir);
  else console.log(`sandbox kept: ${sandboxDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
