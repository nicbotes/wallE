---
name: brain-onboard
description: Read a new team member into a client in about 30 minutes. Use for "onboard me", "I'm new to this client", "read me in", "get me up to speed on <client>".
---

# brain-onboard

The whole point of the brain: the understanding outlives any individual. Your
output is a briefing **in chat** (never a file — don't pollute the brain),
built so a newcomer can operate credibly by the end of it.

## Build the briefing in this order

1. **The org in five sentences** — from `client.md`: what they are, why
   they're a client, the engagement shape.

2. **The five people who matter** — by influence: name, role, disposition +
   one line on what they *actually* want (incentives, flag inferred vs
   stated). Include reporting lines where they explain behaviour. Departed
   people who still cast a shadow (their decisions live on) get one line.

3. **Projects** — each: goal, status, phase, what's in/out/undecided in one
   breath.

4. **The 3–5 decisions that shape everything** — and here, tell the
   *supersession backstory*: a reversal is the highest-signal history in the
   brain ("we self-hosted in Feb, reversed to cloud in July after the outage
   changed the economics — decided jointly by X and Y"). Use
   `npx tsx tools/query-log.ts --client <slug> --type decision-superseded`.
   Build the chronology from **event dates** — `npx tsx tools/timeline.ts
   <slug>` — never commit order. History we only learned recently is still
   history: place it where it happened. Where a fact was reconstructed long
   after the event, say so once ("we only learned this in March") — a newcomer
   should know which parts of the story we watched and which we were told.

5. **Live tensions** — every open one: who vs who, about what, what it
   blocks. These are the rooms the newcomer will walk into.

6. **Last 90 days** — a compressed brain-diff so they know the current
   temperature.

7. **What we don't know** — staleness output + unattributed requirements +
   open questions, framed as "things to validate when you meet people".

8. **A 30-minute reading order** of actual files, so they can verify
   everything you just said: `client.md` → `stakeholders.md` →
   `tensions.md` → each `project.md`/`scope.md` → the 2–3 pivotal drops
   (name them — e.g. the incident and the reversal steering meeting).

Cite entity IDs + source drops throughout, and mark anything stale. End by
offering meeting-prep (`brain-recall`) for whoever they're meeting first.
