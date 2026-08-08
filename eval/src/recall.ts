/**
 * Recall/onboard eval: runs brain-recall questions against the cached
 * after-16 brain state and grades by required-entity-ID presence (plus judge
 * rubrics unless --judge off).
 *
 *   npx tsx eval/src/recall.ts [--model <id>] [--judge on|off] [--stale-ok]
 *
 * Requires a cached after-16 snapshot (produced by a full ingest run).
 */

import Anthropic from "@anthropic-ai/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { removeSandbox, restoreSnapshot, skillhash } from "./sandbox.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS = path.join(REPO, "eval", "corpus", "meridian-energy");

interface Question {
  q: string;
  must_mention: string[];
  rubric: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : fallback;
}

async function ask(sandboxDir: string, model: string, questionText: string): Promise<string> {
  let answer = "";
  const q = query({
    prompt:
      `Use the brain-recall skill to answer this question about the client ` +
      `"Meridian Energy" (clients/meridian-energy):\n\n${questionText}`,
    options: {
      cwd: sandboxDir,
      settingSources: ["project"],
      permissionMode: "bypassPermissions",
      allowedTools: ["Read", "Glob", "Grep", "Bash", "Skill"],
      disallowedTools: ["WebSearch", "WebFetch", "Task", "Write", "Edit"],
      model,
      maxTurns: 40,
    },
  });
  for await (const m of q) {
    if (m.type === "result" && m.subtype === "success") answer = m.result;
  }
  return answer;
}

async function main(): Promise<void> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("ANTHROPIC_API_KEY is required. Aborting.");
    process.exit(2);
  }
  const model = arg("model", process.env["EVAL_MODEL"] ?? "claude-sonnet-5")!;
  const judgeOn = arg("judge", "on") === "on";
  const judgeModel = process.env["EVAL_JUDGE_MODEL"] ?? "claude-haiku-4-5-20251001";
  const hash = skillhash(REPO);
  const staleOk = process.argv.includes("--stale-ok");

  const sandbox = restoreSnapshot(REPO, hash, 16, `recall-${Date.now()}`, staleOk);
  if (!sandbox) {
    console.error(
      `No cached after-16 snapshot for skillhash ${hash}. Run the full ingest eval first ` +
        `(npm run eval -- --drops all), or pass --stale-ok.`,
    );
    process.exit(2);
  }

  const { questions } = parseYaml(
    readFileSync(path.join(CORPUS, "recall-questions.yaml"), "utf8"),
  ) as { questions: Question[] };

  const judge = judgeOn ? new Anthropic() : null;
  let idHits = 0;
  let idTotal = 0;
  let rubricPass = 0;
  let rubricTotal = 0;

  for (const [i, question] of questions.entries()) {
    console.log(`\n[${i + 1}/${questions.length}] ${question.q}`);
    const answer = await ask(sandbox, model, question.q);

    for (const id of question.must_mention) {
      idTotal++;
      const hit = answer.includes(id);
      if (hit) idHits++;
      console.log(`  ${hit ? "✓" : "✗"} mentions ${id}`);
    }

    if (judge) {
      rubricTotal++;
      const msg = await judge.messages.create({
        model: judgeModel,
        max_tokens: 300,
        temperature: 0,
        system:
          "You are grading whether an answer satisfies a rubric. Judge ONLY the rubric. " +
          'Reply with strict JSON: {"pass": true|false, "reason": "<one sentence>"}',
        messages: [
          { role: "user", content: `RUBRIC:\n${question.rubric}\n\nANSWER:\n${answer}` },
        ],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      let pass = false;
      let reason = "unparseable judge output";
      try {
        const parsed = JSON.parse((text.match(/\{[\s\S]*\}/) ?? [text])[0]) as {
          pass: boolean;
          reason: string;
        };
        pass = !!parsed.pass;
        reason = parsed.reason;
      } catch {
        /* keep defaults */
      }
      if (pass) rubricPass++;
      console.log(`  ${pass ? "✓" : "✗"} rubric — ${reason}`);
    }
  }

  console.log(
    `\nID mentions: ${idHits}/${idTotal}` +
      (judgeOn ? ` · rubrics: ${rubricPass}/${rubricTotal}` : ""),
  );
  removeSandbox(sandbox);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
