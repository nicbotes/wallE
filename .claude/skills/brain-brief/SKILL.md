---
name: brain-brief
description: Produce client-facing output from a brain — a status update, a decision history, or the story of how the engagement got here. Use whenever the audience is the CLIENT rather than our own team: they asked why something is the way it is, a new person on their side needs context, or you're preparing a readout, deck or email to send them.
---

# brain-brief

Client-facing output. The audience is **outside our team**, so this is not
`brain-recall` with softer wording — it draws on a deliberately narrower set of
facts.

## Why this exists

A brain holds our read on people: dispositions, inferred motives, who is
blocking whom, which unvoiced disagreement is about to surface. That is exactly
what makes it useful internally, and exactly what must never reach a client.
The damage is silent — nobody notices the leak until it's in a deck.

So the boundary is **enforced in code, not by care**:
`tools/client-view.ts` emits only the safe subset.

## Procedure

1. **Get the filtered view. Never read the brain files directly for a client
   deliverable** — doing so reintroduces exactly the judgement the tool exists
   to remove.
   ```
   npx tsx tools/client-view.ts <slug> [--project <proj-id>]
   npx tsx tools/client-view.ts <slug> --json      # for a UI or further processing
   ```

2. **Write from what it returned, and nothing else.** If a fact you want isn't
   in the output, that is the answer — it is not an invitation to go and fetch
   it. If you believe something excluded genuinely belongs in a client
   document, say so to the user and let them decide; never quietly include it.

3. **Handle `review_required` before anything is sent.** Structured fields are
   filtered exhaustively; **prose is passed through**. Decision rationale is our
   own writing and can carry framing that reads badly outside the team ("won the
   argument", "pushed back", "reluctant"). The tool flags likely passages — it
   is a safety net, not a filter, so it will miss things.
   - Surface every flagged passage to the user.
   - Rewrite framing into neutral, factual language: *"reversal after Bo's cost
     gates won the argument"* → *"revised following a review of run-rate costs"*.
   - Never present our characterisation of a person's behaviour as fact.

4. **Choose the shape** the request calls for:
   - **Status** — projects, phase, scope, requirement states, recent delivery.
   - **Decision history** — decisions in event order with their supersession
     chains. This is usually what "why is it this way?" actually wants: the
     *sequence*, showing what was decided, what replaced it, and when.
   - **Story** — the narrative version: what we set out to do, what changed
     along the way, where it landed. Use `npx tsx tools/timeline.ts <slug>` for
     the event-time ordering, and remember backfilled history belongs at the
     date it happened.

## Rules

- **Their own words are safe; our read on them is not.** A requirement the
  client stated, a decision they made, a date — all fine. Our inference about
  why they wanted it — never.
- **Resolved trade-offs may be discussed; open ones may not** (by default). The
  tool withholds open questions unless `--include-open-tensions` is passed, and
  that flag is for the user to choose, not you.
- **Depersonalise disagreement.** "There was a trade-off between cutover
  downtime and overtime cost, settled by the phased plan" — never "X wanted one
  thing and Y wanted another".
- **Attribute decisions, not attitudes.** Naming who decided something is
  factual and usually flattering. Naming who resisted it is neither.
- **Say what you don't know.** If the brain is thin on a period, say the record
  is thin rather than smoothing over it — this document may be read back to you
  in a room.
- If the user explicitly wants an internal view instead, use `brain-recall`,
  `brain-diff` or `brain-onboard` — they are the internal-audience counterparts
  and carry no such filter.
