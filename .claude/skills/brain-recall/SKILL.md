---
name: brain-recall
description: Answer questions from a client brain — lay of the land, who's who, state of a project, prep for a meeting with a person. Use for any question about a client tracked under clients/.
---

# brain-recall

Read-only. Never edits files, never commits. The brain is the source; your job
is to serve it up with provenance.

## Ground rules

- **Cite as you go**: entity IDs and source drops (`per drop-2024-06-12-…`),
  so every claim is traceable.
- **Flag staleness**: anything whose `last_confirmed` is more than 6 months
  before the most recent drop gets a "may be stale — last confirmed <date>"
  marker. Run `npx tsx tools/staleness.ts <slug>` when the question is broad.
- **Distinguish stated from inferred** — incentives carry `kind` and
  `confidence`; never present an inference as a fact.
- **Surface tensions, don't smooth them.** If the question touches an area
  with an open tension, say so explicitly.
- **Answer in event time.** Chronology comes from entity dates
  (`npx tsx tools/timeline.ts <slug>`), not from commit order. Backstory we
  learned late is ordinary context — a 2022 decision recounted to us last month
  belongs in 2022 in any story you tell, and carries the same weight as
  anything else. Mention *when we learned it* only where the gap matters (a
  fact reconstructed after the fact, or one that explains why we were surprised).

## Modes

### Lay of the land ("where are we with <client>?")
Start from `client.md`'s reading order. Answer with: active projects + phase;
top stakeholders by influence with disposition one-liners; live tensions;
the 2–3 active decisions that shape everything; open gaps (unattributed
requirements, stale facts).

### Who is X? / people questions
Their stakeholder entry + incentives (stated vs inferred) + trajectory: run
`npx tsx tools/query-log.ts --client <slug> --entity <sh-id>` to narrate how
their disposition/role moved over time — the history is often the answer.

### Project state
`project.md` + `scope.md` + requirement statuses + last few log entries +
any decisions in the last 90 days.

### Prep me for a meeting with Y
The consultant's edge, compressed:
1. Who they are, disposition **and trajectory** (how it changed, and why).
2. What they actually want (incentives — stated vs inferred).
3. Requirements they own and each one's status (never walk in not knowing).
4. Open tensions they're a party to — and who's on the other side.
5. Decisions from the last 90 days that affect them (especially reversals).
6. Landmines: stale facts about them, gaps we should close in this meeting.
