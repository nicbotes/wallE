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

1b. **Who else is in the chain** — if the brain has an `orgs.md`, this comes
   before the people, because it is what makes the people make sense. Run
   `npx tsx tools/org-chart.ts <slug>` and narrate it: who we contract with,
   who sits above them (and what they can therefore veto), who sits below and
   is served through them, and which organisations are rivals to each other.
   A newcomer who learns the names before the structure will spend weeks
   mis-reading meetings.

2. **The five people who matter** — by influence, **client-side only**
   (`side: client`/`partner`; our own `side: us` people belong in the
   engagement note, not the client map): name, **organisation**, role,
   disposition + one line on
   what they *actually* want (incentives, flag inferred vs stated). Include
   reporting lines where they explain behaviour. Departed people who still cast
   a shadow (their decisions live on) get one line.

3. **Projects** — each: goal, status, phase, what's in/out/undecided in one
   breath.

4. **The 3–5 decisions that shape everything** — and here, tell the
   *supersession backstory*: a reversal is the highest-signal history in the
   brain ("we self-hosted in Feb, reversed to cloud in July after the outage
   changed the economics — decided jointly by X and Y"). Use
   `npx tsx tools/query-log.ts --client <slug> --type decision-superseded`.
   Build the chronology from **event dates** — `npx tsx tools/timeline.ts
   <slug>` — never commit order. Where a decision carries an `authority`, say
   whose call it was: in a chain, "the organisation above them required it" and
   "our counterparty chose it" are different facts with different
   consequences. History we only learned recently is still history: place it
   where it happened. Where a fact was reconstructed long
   after the event, say so once ("we only learned this in March") — a newcomer
   should know which parts of the story we watched and which we were told.

5. **Live tensions** — every open one: who vs who, **what each side argued**
   (the `positions`), and what it blocks. The positions are the part that makes
   this actionable — they tell a newcomer what they'll be walking into and
   which arguments have already been made.

5b. **How this org actually works** — the observations: budget and procurement
   rhythms, standing constraints, personal histories between stakeholders, what
   each key person expects in a meeting. This is the section that saves a
   newcomer six months of learning things the hard way.

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
