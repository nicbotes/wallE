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

### 3. Save the drop — first commit
Write `clients/<slug>/drops/YYYY-MM-DD-<short-label>.md`:
- Frontmatter per SCHEMA.md (`id`, `date`, `type`, `title`, `participants` with
  names verbatim, `ingested` = today).
- Body: the raw input, **verbatim**. No cleanup, no summarising.

```
tools/commit-finding.sh -c <slug> -t drop -e <drop-id> -s <drop-id> \
    -m "<type>: <short title>" clients/<slug>/drops/<file>
```

### 4. Read current state
Read `stakeholders.md` (always) plus every file the drop plausibly touches
(the project's files if a project is referenced, `tensions.md`, `incentives.md`,
relevant `decisions.md`). You cannot extract deltas without knowing the
current state.

### 5. Draft the findings ledger — BEFORE editing anything
List every candidate finding as: `<finding-type> | <entity-id> | <one-line>`.
While drafting:

- **Resolve names against existing stakeholders.** "Tom" might be
  `sh-tom-nagel`. Check role and context. If still unsure who is meant, do NOT
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
- **Noise stays out.** Small talk, tangents, and possibilities explicitly *not*
  decided are not findings. When in doubt whether something is a finding, it
  probably isn't — but say so in your narration (step 8).

Order the ledger by dependency: stakeholders → projects → incentives /
requirements / decisions / scope → tensions → log entries → confirm.

### 6. Apply, one finding at a time
For each ledger line: make the edit (match the template headings and yaml
field sets exactly — SCHEMA.md is normative), then commit immediately:

```
tools/commit-finding.sh -c <slug> -t <finding-type> -e <entity-id> \
    -s <drop-id> [-p <proj-id>] [-a <sh-id>] [-r <refs>] \
    -m "<imperative summary ≤72 chars>" <changed file(s)>
```

Every commit from this ingest carries the same `-s <drop-id>`.
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
