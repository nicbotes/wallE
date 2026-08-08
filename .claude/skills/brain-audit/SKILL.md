---
name: brain-audit
description: Check a client brain's hygiene — schema violations, unattributed facts, broken supersession chains, stale facts, contradictions not logged as tensions. Use on request or before a big recall/onboarding.
---

# brain-audit

Reports first; fixes only with the user's approval, and then only via
`correction` commits through the gate. Never rewrites history.

## Procedure

1. **Mechanical pass**:
   ```
   npx tsx tools/validate.ts <slug>
   ```
   Every error is a defect; every warning (unattributed requirements) is a
   gap to chase.

2. **Staleness pass**:
   ```
   npx tsx tools/staleness.ts <slug> --months 6
   ```
   For a long-lived brain, pass `--as-of` the date of the latest drop, not
   today, if ingestion lags reality.

3. **Judgment pass** — read the brain like a sceptical reviewer:
   - Requirements or decisions from different stakeholders that contradict
     each other with **no matching entry in `tensions.md`** — the worst kind
     of silent smoothing.
   - Dispositions that no longer square with recent drops.
   - Prose that asserts things the yaml doesn't (or vice versa).
   - Incentives still marked `inferred` that later drops effectively
     confirmed or refuted.

4. **Report**, grouped: `MECHANICAL` (validator errors) / `STALE` /
   `GAPS` (unattributed) / `JUDGMENT`. Each item: file, entity id, what's
   wrong, suggested fix.

5. **Fix only what the user approves**: each fix is a `correction` commit
   (`-r` the offending commit SHA where identifiable). Batch nothing;
   one defect, one commit.
