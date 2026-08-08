/**
 * LLM judge for prose-quality rubrics. Deliberately narrow: binary verdicts on
 * ≤2 rubrics per drop, temperature 0, pinned cheap model, strict JSON out.
 * Judge scores are reported separately and never blended into the
 * deterministic aggregate.
 */

import Anthropic from "@anthropic-ai/sdk";
import { parseAllBlocks, parseBrain } from "../../../tools/lib/parser.js";
import { candidatesFor, resolveMatcher, type JudgeGolden, type EntityType } from "../goldens.js";

export interface JudgeResult {
  rubric: string;
  pass: boolean;
  reason: string;
}

const TYPE_TO_SECTION: Record<string, EntityType> = {
  stakeholder: "stakeholders",
  project: "projects",
  incentive: "incentives",
  observation: "observations",
  decision: "decisions",
  requirement: "requirements",
  tension: "tensions",
  scope: "scope",
};

export async function judgeDrop(
  sandboxDir: string,
  slug: string,
  judges: JudgeGolden[],
  dropText: string,
  model: string,
): Promise<JudgeResult[]> {
  if (!judges.length) return [];
  const client = new Anthropic();
  const clientsDir = `${sandboxDir}/clients`;
  const brain = parseBrain(clientsDir, slug);
  const blocks = parseAllBlocks(clientsDir, slug);
  const results: JudgeResult[] = [];

  for (const j of judges) {
    const { type, ...matcher } = j.target;
    const section = TYPE_TO_SECTION[type];
    if (!section) {
      results.push({ rubric: j.rubric, pass: false, reason: `unknown judge target type ${type}` });
      continue;
    }
    const pool = candidatesFor(section, brain, blocks);
    const r = resolveMatcher(matcher, pool);
    if (!r.ok) {
      results.push({ rubric: j.rubric, pass: false, reason: "target entity not found in brain" });
      continue;
    }
    const block = blocks.find((b) => b.id === r.id);
    const entityText = block
      ? `## ${block.displayName} (${block.id})\n\nFields: ${JSON.stringify(block.fields)}\n\nProse:\n${block.prose}`
      : `Fields: ${JSON.stringify(r.fields)}`;

    const msg = await client.messages.create({
      model,
      max_tokens: 300,
      temperature: 0,
      system:
        "You are grading whether a knowledge-base entry satisfies a rubric. " +
        "Judge ONLY the rubric — not style, not completeness beyond it. " +
        'Reply with strict JSON: {"pass": true|false, "reason": "<one sentence>"}',
      messages: [
        {
          role: "user",
          content:
            `RUBRIC:\n${j.rubric}\n\n` +
            `THE ENTRY BEING GRADED:\n${entityText}\n\n` +
            `THE SOURCE MATERIAL IT WAS EXTRACTED FROM:\n${dropText}`,
        },
      ],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text) as { pass: boolean; reason: string };
      results.push({ rubric: j.rubric, pass: !!parsed.pass, reason: parsed.reason ?? "" });
    } catch {
      results.push({ rubric: j.rubric, pass: false, reason: `unparseable judge output: ${text.slice(0, 120)}` });
    }
  }
  return results;
}
