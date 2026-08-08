---
name: brain-diff
description: Explain what changed in a client brain since a date, meeting, or point in time. Use for "what changed since…", "what happened while I was out", "what's new with <client>".
---

# brain-diff

Read-only. Git history is the record of how understanding evolved; your job is
to narrate the delta as *changes in understanding*, not file edits.

## Procedure

1. **Resolve the anchor** to a date or commit: a date ("since March"), an
   event ("since the steering meeting" → find the drop, use its ingest
   commits), or "last time we spoke" (ask if ambiguous).

2. **Pull the event stream**:
   ```
   npx tsx tools/query-log.ts --client <slug> --since <date-or-ref>
   ```
   For any event needing depth, `git show <sha>` gives the exact diff.

3. **Narrate, most consequential first** — always as was → is:
   - **Reversals first**: decisions superseded (what was decided, what
     replaced it, who, why).
   - **People**: arrivals, departures, disposition and reporting-line shifts.
   - **Tensions**: opened and resolved (and what resolved them).
   - **Scope and requirements**: moves, drops, deliveries.
   - **Delivery events**: incidents, milestones.
   Group by project where it helps. Every item: short SHA + source drop.

4. **Close with the unchanged-but-live**: open tensions and stale facts that
   did NOT move in the window — what's still hanging is part of the answer.

If nothing material changed, say exactly that in one line.
