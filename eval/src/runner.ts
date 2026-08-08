/**
 * Drives the real brain-ingest skill headlessly via the Claude Agent SDK —
 * one query() per drop, inside the hermetic sandbox.
 *
 * The sandbox is disposable, network tools are disallowed, and only the
 * capability layer is present, which is why permissionMode is
 * bypassPermissions here — a deliberate, contained choice.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

export interface DropSpec {
  seq: number;
  id: string;
  date: string;
  type: string;
  title: string;
  text: string;
}

export interface RunUsage {
  costUsd: number;
  turns: number;
  durationMs: number;
}

export async function ingestDrop(
  sandboxDir: string,
  clientName: string,
  drop: DropSpec,
  model: string,
  onProgress?: (line: string) => void,
): Promise<RunUsage> {
  const started = Date.now();
  const prompt =
    `Use the brain-ingest skill to ingest the following context drop for the ` +
    `client "${clientName}".\n\n` +
    `Drop date: ${drop.date}\n` +
    `Drop type: ${drop.type}\n` +
    `Suggested title: ${drop.title}\n\n` +
    `--- RAW DROP CONTENT (save verbatim) ---\n${drop.text}`;

  let costUsd = 0;
  let turns = 0;

  const q = query({
    prompt,
    options: {
      cwd: sandboxDir,
      settingSources: ["project"],
      permissionMode: "bypassPermissions",
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Skill", "TodoWrite"],
      disallowedTools: ["WebSearch", "WebFetch", "Task"],
      model,
      maxTurns: 100,
    },
  });

  for await (const message of q) {
    if (message.type === "assistant") turns++;
    if (message.type === "result") {
      costUsd = message.total_cost_usd ?? 0;
      if (message.subtype !== "success") {
        onProgress?.(`  ! runner finished with subtype=${message.subtype}`);
      }
    }
  }

  return { costUsd, turns, durationMs: Date.now() - started };
}
