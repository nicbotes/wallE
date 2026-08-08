---
name: brain-ingest
description: Turn a context drop about a client into attributed findings committed one by one. Use whenever the user shares raw material about a client — a meeting transcript, email, Slack paste, incident report, delivery update, personnel news, or spoken/dictated context.
---

# brain-ingest

You are capturing what a good consultant would carry in their head — who's who,
what each person actually wants, what was decided and reversed, where the
tensions are — into the client's brain, with full attribution and provenance.

**Read `schema/SCHEMA.md` and `schema/FINDINGS.md` first** if you haven't in
this session. They are normative; this skill is the procedure.

## Non-negotiables

- Attribute everything to a stakeholder, or mark it `unattributed` (requirements)
  / `inferred` with confidence (incentives). Never guess an attribution.
- Hold contradictions: log a tension, don't pick a winner.
- Never delete or rewrite history: supersede decisions; fix your own extraction
  mistakes with `correction` commits; never amend/rebase/squash.
- The raw input is sacred: save it verbatim before extracting anything.
- One finding, one commit, always through `tools/commit-finding.sh`.

## Procedure

### 1. Identify the client
Match the context to a directory under `clients/`. If none exists, run
`brain-init` first. If genuinely ambiguous which client this is, ask.

### 2. Establish the drop's date and type
Take the date **from the content** (meeting date, email date). If the material
is historical and undated, ask — never silently stamp today's date on old
material. Pick the type: `meeting | workshop | email | slack | incident |
update | note` (dictated/spoken context = `note`).

Two clocks apply (see `schema/SCHEMA.md`) — decide which case you're in:

- **A historical artifact** (an old email, an archived record handed over now):
  the drop's `date` is when it was *written*; `ingested` is today. Drops need
  not arrive in date order.
- **History recounted in a current conversation:** the drop is dated **today** —
  that meeting did happen today — and the *entities* you extract from it carry
  their own, older event dates. Do not backdate the drop to the story it tells.

### 3. Save the drop — first commit
Write `clients/<slug>/drops/YYYY-MM-DD-<short-label>.md`:
- Frontmatter per SCHEMA.md (`id`, `date`, `type`, `title`, `participants` with
  names verbatim, `ingested` = today).
- Body: the raw input, **verbatim**. No cleanup, no summarising.

```
tools/commit-finding.sh -c <slug> -t drop -e <drop-id> -s <drop-id> \
    -m "<type>: <short title>" clients/<slug>/drops/<file>
```

### 3b. Raw transcripts (Fathom, Gemini, Otter…)
Skip if the drop isn't machine-transcribed. Set `type: transcript` and
`source_tool:`, and keep `participants` as the **speaker labels verbatim**.

- **Map every speaker before extracting anything:**
  ```
  npx tsx tools/speakers.ts <slug> <drop-id>
  ```
  It lists each label with its share of the talking and whether it already
  resolves via a stakeholder's `name`/`aliases`. Resolve *all* of them:
  - Known person under a new label ("Bo", "bo@…", "Bo R. (Acme)") → add the
    label to their `aliases` (`stakeholder-update`). This is what makes the
    next transcript map cleanly.
  - New client person → `stakeholder-new` as usual.
  - **One of ours** → `stakeholder-new` with `side: us`. Record them so labels
    resolve, but they are never client stakeholders and must not pad the map.
  - A third party (another vendor, an auditor) → `side: partner`.
  - A room, a phone, "Unknown Speaker" → not a person; don't create anything.
- **The auto-summary is derived, and can be wrong.** Fathom/Gemini exports
  often lead with a summary and action items. Preserve them (the drop is
  verbatim) but **extract from the transcript body**; treat the summary as a
  hint about where to look, never as a source of fact.
- **Expect ASR damage.** Names, product names and jargon get mangled. Resolve a
  garbled name from role and context if you safely can; otherwise log an open
  question rather than inventing a person. Quotes drawn from a transcript are
  approximate — say "per the transcript" rather than presenting them as exact.
- **Attribution is now easy — use it.** Speaker labels tell you exactly who
  said what. There is far less excuse for an `unattributed` requirement here.

### 4. Read current state
Read `stakeholders.md` (always) plus every file the drop plausibly touches
(the project's files if a project is referenced, `tensions.md`, `incentives.md`,
relevant `decisions.md`). You cannot extract deltas without knowing the
current state.

### 5. Draft the findings ledger — BEFORE editing anything
List every candidate finding as: `<finding-type> | <entity-id> | <one-line>`.
While drafting:

- **Resolve names against existing stakeholders.** "Sam" might be
  `sh-sam-osei`. Check role and context. If still unsure who is meant, do NOT
  guess — record it as a `tension-opened` (kind: open question) instead.
- **New people** get deterministic IDs: `sh-<given>-<family>` from the name as
  written; on collision append `-2`.
- **Departures** are `stakeholder-update` (status → departed), never deletion.
- **A reversed decision** is ONE finding (`decision-superseded`): add the new
  entry AND stamp the old one (`status: superseded`, `superseded_by`) in the
  same commit.
- **A resolved tension** references the resolving decision (`resolved_by`), so
  the decision's finding must come first.
- **Contradictions between stakeholders** in this drop = `tension-opened`.
- **Re-confirmations** (existing fact restated, nothing changed) go in one
  batch: collect entity IDs for a single `confirm` commit at the end.
- **Most of a transcript is discussion, not findings — and some of it is still
  worth keeping.** An hour of talk might yield one decision. It will usually
  also surface *durable context*: their budget cycle locks in March,
  procurement needs three quotes over £50k, two people worked together at a
  previous employer, this CFO always opens with run-rate. That is
  `observation-new` — the test is **would this change how a colleague behaves
  in a meeting six months from now?** If yes, record it (`about` a person, a
  project, or `org`; mark confidence). If no, it stays in the drop, which
  keeps everything verbatim anyway.
- **Noise stays out.** Small talk, scheduling, tangents, and possibilities
  explicitly *not* decided are not findings and not observations. When in doubt
  whether something is a finding, it probably isn't — but say so in your
  narration (step 8) so the judgment is visible.
- **Restraint about people.** Never record personal or sensitive detail
  (health, family, private circumstances) that happens to be caught on a
  transcript, and never record disparaging characterisations as facts. If
  someone's frustration matters professionally, record the professional
  substance — a tension, a disposition change — not the venting.
- **Backstory is a finding, dated when it happened.** When a drop explains
  history — an old decision nobody told us about, why someone has been wary
  since a failed project, a requirement's real origin — record it with its
  **own event date**, `source` = this drop, and `Backfill: true` on the commit.
  It is not a git-history footnote; it becomes live context the moment it
  lands. Date what you can pin down; if only the year or "about two years ago"
  is known, use a defensible approximation and say so in the prose rather than
  inventing precision.
- **Backfill can reach into existing entities:** an older drop that features a
  known stakeholder corrects their `first_seen` (`stakeholder-update`);
  learning who was really behind an `unattributed` requirement is a
  `requirement-update`; learning of the decision that one we already hold
  replaced is a single `decision-superseded` (see `schema/FINDINGS.md`).
  None of these are `correction`s — we weren't wrong, we just didn't know.
- **Recounted history doesn't bump `last_confirmed`.** Only a present-tense
  claim ("that's still our position") re-confirms a fact; "back then we
  decided X" does not.

Order the ledger by dependency: stakeholders → projects → incentives /
observations / requirements / decisions / scope → tensions → log entries →
confirm.

### 6. Apply, one finding at a time
For each ledger line: make the edit (match the template headings and yaml
field sets exactly — SCHEMA.md is normative), then commit immediately.
**Insert entries in event-date order** among their peers — a backfilled 2022
decision goes above the 2024 ones, so the decision and delivery logs read as
chronologies. Append-only means never deleting, not always writing last.

```
tools/commit-finding.sh -c <slug> -t <finding-type> -e <entity-id> \
    -s <drop-id> [-p <proj-id>] [-a <sh-id>] [-r <refs>] [-B] \
    -m "<imperative summary ≤72 chars>" <changed file(s)>
```

Every commit from this ingest carries the same `-s <drop-id>`. Pass `-B` when
the finding's event date predates the drop by more than ~a month — it stamps
`Backfill: true`.
New project? Copy `projects/_template` → `projects/<proj-slug>` and commit as
`project-new` before anything that lives inside it.

### 7. Validate
```
npx tsx tools/validate.ts <slug>
```
Fix any errors with `correction` commits (`-r` the offending commit SHA).
Warnings about unattributed requirements are acceptable — they're flagged gaps.

### 8. Narrate what changed
Plain English, most consequential first: new people and disposition shifts,
decisions made or reversed, tensions opened/resolved, scope moves. Include the
short SHA per finding. Then — honesty matters — list anything the drop implied
that you deliberately did **not** record, and why (noise, no attribution,
explicitly undecided).
