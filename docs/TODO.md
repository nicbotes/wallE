# TODO

What's deliberately unfinished, roughly in the order it should be tackled. Each
item says *why it matters* and *what done looks like*, so it stays actionable
months from now.

---

## 1. Validate against real material ⚠️ the big one

**Everything in this repo has only ever met synthetic data.** The corpus was
authored by the same process that reads it, which is a real bias: it cannot
surprise us. The insurance spine, the transcript pipeline, and the compression
claim are all currently *plausible*, not *verified*. Until a real Fathom/Gemini
export has been through the pipeline, treat the tuning as provisional.

### 1.1 Run the spine against real client wording

The vocabulary was written from domain knowledge, not from how your clients
actually speak.

```bash
npx tsx tools/spine.ts resolve insurance "<a real sentence from a real transcript>"
```

Do this with a couple of dozen real sentences. Expect to:

- **Add `alt:` labels** — every industry has house words the pack won't have.
- **Find cross-facet collisions.** The very first realistic sentence tested hit
  one: *"benefit schedule"* matched `concern:delivery`, because "schedule" was
  a synonym there. In insurance a schedule is a document, so it moved to
  `component:document`. There will be more, and only real wording surfaces them.
- **Delete terms nobody uses.** A term that never fires is noise in the picker.

*Done when:* a sample of real sentences resolves to terms a consultant agrees
with, and false positives have been pruned.

### 1.2 Ingest a real transcript end to end

Pick one real (ideally messy) meeting. Run `brain-init` then `brain-ingest`, and
inspect what comes out. Specifically check the things synthetic data can't test:

- **Speaker labels.** `npx tsx tools/speakers.ts <slug>` — how many labels went
  unmapped? Real exports produce "Nic (Root)", bare first names, email
  addresses, room names, "Unknown Speaker". The alias mechanism is designed for
  this but has only seen four tidy labels.
- **`side: us` discipline.** Did our own people stay out of the client map?
- **Observations.** Is the "would this change how a colleague behaves in six
  months?" test producing useful notes, or noise, or nothing? This is the
  judgement most likely to need prompt tuning.
- **Topic tagging.** Useful, or is the agent forcing tags? Under-tagging is the
  intended failure mode; check it's failing in that direction.
- **Commit volume.** One finding per commit on a real hour-long meeting — is the
  history readable, or does it need more aggressive batching?

*Done when:* one real transcript is ingested, validated, and a human agrees the
resulting brain is worth having.

### 1.3 Measure the real compression ratio

The README claims ~20–30× (raw drops vs curated projection). That is an
*estimate* from synthetic drops, not a measurement.

```bash
npx tsx tools/stats.ts <slug>
```

*Done when:* the README quotes a measured figure from a real client, or the
claim is corrected. This number also decides when `tools/index.ts` (vector
search over `drops/`) becomes worth building.

### 1.4 Sanity-check the thresholds

All picked by judgement, none tested against reality:

| Threshold | Where | Question |
| --- | --- | --- |
| 30 days | `tools/timeline.ts` `BACKFILL_DAYS` | Does "backfill" trigger sensibly on real drops? |
| 6 months | `tools/staleness.ts` | Right cadence for how often you actually meet clients? |
| 72 chars | `tools/commit-finding.sh` | Too tight for real finding summaries? |
| one `confirm` per drop | `schema/FINDINGS.md` | Right batching for a real meeting's re-confirmations? |

---

## 2. Quality gaps left open

### 2.1 First live eval baseline has never been run
No extraction quality figure exists — the harness is proven by a scripted
grader self-test, not by a real agent run. See [`INIT.md`](../INIT.md) for the
one-command procedure. **This blocks meaningful iteration on the ingest skill**,
since without a baseline there's nothing to measure a change against.

### 2.2 Topic-tagging quality is ungraded
The mechanism has unit tests; whether the agent *chooses* good topics is not
graded. The eval corpus is a utility company and no pack covers that domain.
Either add a small `domains/utilities/` pack and topic assertions to the
goldens, or build a second corpus in a domain a pack already covers. Deferred
deliberately: adding untested golden assertions before the first baseline would
risk destabilising it.

### 2.3 `eval/src/recall.ts` has never run live
Six questions with required-entity-ID grading plus judge rubrics, written but
never executed. Needs a cached `after-18` state from a full ingest run.

---

## 3. Designed, not built

### 3.1 Client-safe view — ✅ built, one gap remains
`tools/client-view.ts` + the `brain-brief` skill. The filter is enforced in
code (a prompt rule is a promise; a function that never emits the field is a
boundary) and tested against a fixture deliberately loaded with damaging
material.

**The residual gap: prose.** Structured fields are filtered exhaustively, but
decision rationale is our own writing and passes through. The tool flags
passages that read like internal framing ("won the argument", "pushed back")
and refuses to declare the output client-ready until a human has looked — but
that heuristic will miss things. Two ways to close it further:
- Have `brain-ingest` write decision rationale in neutral language from the
  start, so the client-facing path has less to sanitise.
- Grade it: an eval that feeds a brain to `client-view` and has a judge check
  for anything a client shouldn't read.

### 3.2 Topic-filtered timeline + visual
`tools/timeline.ts` already emits event-ordered JSON with backfill marking. Add
`--topic` filtering and render a shareable HTML/Mermaid timeline: decisions with
supersessions drawn as replacements (the visually striking bit), tensions
opening and closing, scope moves, annotated with who drove each.

### 3.3 Positions under tensions (IBIS) — now the biggest single win
Tensions currently record the parties, not what each argued. Recording each
stakeholder's *position* is a small schema change that makes "why" narratives
substantially richer — this is the IBIS model (Issues → Positions → Arguments),
designed for exactly this problem.

### 3.4 HubSpot sync spike
HubSpot stays system-of-record for contacts/companies/deals; the brain is the
delivery-understanding layer it has no model for. Pull stakeholders on
`brain-init` (seeding names, titles, emails — which also pre-populates the
`aliases` that make speaker matching work), and push back a thin digest so
people who never open the repo see something. A contained spike:
`tools/hubspot-sync.ts` + a `brain-init` step.

### 3.5 Vector index over drops
Contract is documented in `tools/index.ts`; deliberately unbuilt. Trigger is
1.3's measurement: when a client's `drops/` outgrows the context window while
the brain stays small. Index `drops/`, never the brain — the brain is meant to
be read whole.

---

## Notes

- Adoption is the real risk, not capability. Files-and-git is excellent for an
  agent and for one maintainer; it is a barrier for a consultant who lives in a
  browser. A worse data model that everyone updates beats a better one nobody
  touches.
- The observations entity only works while it stays disciplined. If it becomes
  a dumping ground, the projection grows with the log and the compression
  advantage in 1.3 disappears. `brain-audit` flags observation rot — use it.
