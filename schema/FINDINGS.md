# Finding taxonomy & commit protocol (normative)

A **finding** is one atomic change to the brain's structured understanding,
traceable to one source drop. Every finding is its own git commit, made through
`tools/commit-finding.sh` — never by hand. Git history is the event stream of
understanding; these commits are its records.

## Finding types

| Type | Meaning |
| --- | --- |
| `brain-init` | Client brain scaffolded from template |
| `drop` | Raw input saved verbatim — **always the first commit of an ingest** |
| `stakeholder-new` | New person identified |
| `stakeholder-update` | Any field change: role, disposition, reports_to, departure |
| `incentive-new` | New stated or inferred motive |
| `incentive-update` | Kind/confidence change (e.g. inferred → confirmed stated) |
| `observation-new` | Durable "good to know" context recorded |
| `observation-update` | Observation revised, re-scoped or confidence changed |
| `requirement-new` | New requirement |
| `requirement-update` | Status/priority/attribution change |
| `decision-new` | Decision with no predecessor |
| `decision-superseded` | New decision replacing an old one — new entry + `status`/`superseded_by` stamp on the old, **one commit, both edits** |
| `scope-move` | Item enters scope or moves between in/out/undecided |
| `tension-opened` | Contradiction, open question, or conflict logged |
| `tension-resolved` | Tension closed (usually by a decision — `Refs:` it) |
| `project-new` | Project directory created from template |
| `project-update` | Charter change: status, phase |
| `log-entry` | Delivery update / incident / milestone appended to a project log |
| `confirm` | ALL `last_confirmed` bumps from one drop, batched — **at most one per drop** |
| `correction` | Fix of a prior extraction error; `Refs:` the bad commit |

## Commit message format

```
<finding-type>(<client-slug>): <imperative summary, ≤72 chars>

<optional 1–3 sentence body>

Client: acme-utilities
Project: proj-crm-rollout
Finding: decision-superseded
Entity: dec-20240718-buy-not-build
Refs: dec-20240211-build-inhouse
Attributed-To: sh-bo-reyes
Source: drop-2024-07-18-steering
```

Trailer rules:

- `Client`, `Finding`, `Entity`, `Source` — **mandatory on every finding commit**.
- `Project` — required for project-level findings, omitted for org-level.
- `Refs` — optional, comma-separated related entity IDs (the superseded
  decision, the resolving decision, the corrected commit SHA).
- `Backfill` — optional, `true` when the finding's **event date predates its
  source drop by more than ~30 days** (see the two-clocks section of
  `schema/SCHEMA.md`). It marks "we learned something old", not "something new
  happened", so `brain-diff` can narrate the two honestly. Backfill uses the
  ordinary finding types — there is no separate backfill type.
- `Attributed-To` — optional, the stakeholder who said/decided it.
- For `drop` commits: `Entity` and `Source` are both the drop id.
- For `brain-init`: `Entity` is the client slug, `Source` is `manual`.
- For `confirm` commits: `Entity`/`Source` are the drop id; `Refs` lists the
  re-confirmed entity IDs.

Standard git trailers — queryable with:

```
git log --format='%H %(trailers:key=Finding,valueonly,separator=%x2C)'
git log --grep 'Finding: decision-superseded'
npx tsx tools/query-log.ts --client acme-utilities --type decision-superseded
```

## Backfill

Late-arriving history is committed like anything else — same types, same
ordering, `Source:` still the drop that taught us — plus `Backfill: true`. Three
cases need care:

- **Retro-supersession.** Learning of an older decision that one we already hold
  replaced: add the old entry (dated then), stamp the reciprocal
  `supersedes`/`superseded_by` pair, and commit both edits as ONE
  `decision-superseded` — exactly as if it had arrived in order.
- **Retro-attribution.** Learning who was behind a requirement previously
  recorded `unattributed` is a `requirement-update`, not a `correction` — we
  were not wrong before, we simply did not know.
- **`correction` vs backfill.** `correction` is for *our extraction being
  wrong*. New history that we never had is not a correction.

## Ingest ordering (per drop)

1. **`drop` commit first** — the raw input, verbatim, before any extraction.
2. Findings in dependency order: stakeholders before anything attributed to
   them; `project-new` before its scope/requirements; `decision-new`/
   `decision-superseded` before a `tension-resolved` that cites it.
3. At most one `confirm` commit last.

All commits from one ingest share the same `Source:` trailer, so
`query-log.ts --source <drop-id>` reconstructs the drop's full impact.

## Commit hygiene

- One finding, one commit. A commit touches only the file(s) that hold its
  entity (a `decision-superseded` touches one decisions file; a
  `stakeholder-new` touches `stakeholders.md`).
- No mega-commits (multiple findings squashed) and no pathological splitting
  (one finding spread over several commits). The eval harness grades this.
- Never amend, rebase, or squash brain history. Corrections are new commits.
