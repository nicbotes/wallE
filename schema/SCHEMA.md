# Brain schema (normative)

This document defines the file layout, entity encoding, field sets, and ID
rules for a client brain. `tools/validate.ts` enforces it mechanically; skills
cite it. If this document and a skill disagree, this document wins.

## Principles

1. **Attribute everything.** Every requirement, decision, and incentive ties to
   a stakeholder ID — or is explicitly marked `unattributed` (a gap to close)
   or `inferred` (with confidence).
2. **Hold contradictions.** When stakeholders conflict, log a tension. Never
   silently pick a winner.
3. **Never delete history.** Entities are superseded or status-changed, never
   removed. Extraction mistakes are fixed by `correction` commits.
4. **Drops are immutable.** Raw inputs are saved verbatim before extraction and
   never edited after their commit.
5. **`last_confirmed` drives staleness.** Re-confirmation of an existing fact
   by a new drop bumps the date.

## Layout per client

```
clients/<client-slug>/
├── client.md            # profile, engagement map, reading order
├── stakeholders.md      # org-level: people outlive projects
├── incentives.md        # org-level: stated vs inferred motives
├── tensions.md          # org-level: tensions span projects by design
├── decisions.md         # org-level decisions only (governance, standards)
├── drops/
│   └── YYYY-MM-DD-<slug>.md      # THE EVENT LOG: every raw input, verbatim
└── projects/<proj-slug>/
    ├── project.md       # charter: goal, status, phase, dates
    ├── scope.md         # ## In / ## Out / ## Undecided
    ├── requirements.md
    ├── decisions.md     # project-level decisions
    └── log.md           # append-only: delivery updates, incidents, milestones
```

Org-level facts (people, incentives, tensions, org-wide decisions) live at the
client root. Delivery facts (scope, requirements, decisions, log) live per
project.

## Entity encoding

Every entity is:

    ## <Display Name> (<id>)

    ```yaml
    <structured fields>
    ```

    <free prose: context, nuance, history notes>

One heading, then exactly one fenced `yaml` block, then prose. Files stay
readable end-to-end; the parser needs only "headings + first yaml fence";
diffs stay local to the entity touched.

`client.md` and `project.md` are single-entity files: one `# <Title>` heading,
one yaml block, prose.

## ID rules

IDs are immutable forever. Renames, role changes, and reversals are updates or
supersessions — never ID edits.

| Entity | Format | Determinism |
| --- | --- | --- |
| Client | `<kebab-name>` e.g. `acme-utilities` | derived from name |
| Stakeholder | `sh-<given>-<family>` e.g. `sh-ada-vance`; collision → `-2` | derived from name as first written |
| Project | `proj-<slug>` | derived from project name |
| Drop | `drop-YYYY-MM-DD-<slug>`; filename `YYYY-MM-DD-<slug>.md` matches | derived from date + short label |
| Decision | `dec-YYYYMMDD-<slug>` | date deterministic, slug chosen at write time |
| Requirement | `req-<slug>` | slug chosen at write time |
| Tension | `ten-<slug>` | slug chosen at write time |
| Incentive | `inc-<sh-suffix>-<slug>` e.g. `inc-ada-vance-ship-fast` | slug chosen at write time |
| Scope item | `scp-<slug>` | slug chosen at write time |
| Finding | the git commit SHA | git is the findings registry |

## Field sets

Enum values are closed sets; the validator rejects others. Optional fields are
marked `?`. Dates are `YYYY-MM-DD`.

### Stakeholder (`stakeholders.md`)

```yaml
id: sh-ada-vance
name: Ada Vance
role: VP Engineering
org_unit: Technology            # ? free text
status: active                  # active | departed
disposition: champion           # champion | supportive | neutral | skeptical | blocker | unknown
influence: high                 # high | medium | low
reports_to: sh-lee-park        # ? stakeholder id
projects: [proj-crm-rollout]   # may be empty
first_seen: drop-2024-01-08-kickoff   # drop id
last_confirmed: 2024-07-18
sources: [drop-2024-01-08-kickoff]    # drop ids, grows over time
```

Prose sections after the yaml block (free-form, recommended headings):
**Incentive summary**, **History**.

### Incentive (`incentives.md`)

```yaml
id: inc-bo-reyes-cost-control
stakeholder: sh-bo-reyes
kind: stated                    # stated | inferred
confidence: high                # high | medium | low (stated facts are usually high)
source: drop-2024-01-08-kickoff
last_confirmed: 2024-01-08
```

Prose: the incentive itself — what they want, what winning/losing looks like
for them personally.

### Decision (`decisions.md`, org- or project-level)

```yaml
id: dec-20240718-buy-not-build
date: 2024-07-18
status: active                  # active | superseded
decided_by: [sh-bo-reyes, sh-ada-vance]   # stakeholder ids; [] only if truly unknown
supersedes: dec-20240211-build-inhouse      # ? decision id
superseded_by: null                             # ? decision id, set when superseded
source: drop-2024-07-18-steering
```

Prose: what was decided, why, context. Files are append-only: a supersession
adds the new entry and edits exactly two fields on the old one (`status`,
`superseded_by`).

### Requirement (`projects/<p>/requirements.md`)

```yaml
id: req-sso-login
stated_by: sh-kai-ito       # stakeholder id | unattributed
date: 2024-02-02
status: active                  # active | delivered | dropped | superseded
priority: must                  # must | should | could | unknown
source: drop-2024-02-02-requirements
last_confirmed: 2024-02-02
```

`stated_by: unattributed` is a flagged gap — the validator reports it; audit
chases it. Never drop a requirement because nobody owned it.

### Tension (`tensions.md`)

```yaml
id: ten-rollout-pace
status: open                    # open | resolved
between: [sh-kai-ito, sh-bo-reyes]   # stakeholder ids
opened: 2024-04-03
source: drop-2024-04-03-workshop
resolved: null                  # ? date
resolved_by: null               # ? decision id
```

Prose: the contradiction, each side's position, what it blocks.

### Scope item (`projects/<p>/scope.md`)

Scope items live under the section headings `## In`, `## Out`, `## Undecided`
as entity blocks:

```yaml
id: scp-email-campaigns
state: undecided                # in | out | undecided — must match its section
since: 2024-02-02
decided_by: []                  # ? stakeholder ids, for in/out moves
source: drop-2024-02-02-requirements
```

Movement history lives in git (each `scope-move` is a commit), not in the file.

### Log entry (`projects/<p>/log.md`)

Heading form `## YYYY-MM-DD <title>`:

```yaml
kind: incident                  # update | incident | milestone
date: 2024-06-01
source: drop-2024-06-01-incident
involves: [sh-kai-ito]      # ? stakeholder ids
```

Append-only, newest at the bottom.

### Project charter (`projects/<p>/project.md`)

```yaml
id: proj-crm-rollout
name: CRM Rollout
status: active                  # active | paused | delivered | killed
phase: build                    # free text: discovery | build | migrate | ...
started: 2024-01-08
```

### Client profile (`client.md`)

```yaml
id: acme-utilities
name: Acme Utilities
schema_version: 1
first_contact: 2024-01-08
```

Prose: what the org is, the engagement map, and a **Reading order** section
telling a newcomer which files to read in what sequence.

### Drop (file-level frontmatter in `drops/*.md`)

```yaml
id: drop-2024-01-08-kickoff
date: 2024-01-08
type: meeting                   # meeting | workshop | email | slack | incident | update | note
title: Kickoff — billing replatform
participants: [Ada Vance, Bo Reyes]   # names verbatim as they appear
ingested: 2026-08-08            # date the drop was ingested
```

Body: the raw input, verbatim. Never edited after commit. Drops use YAML
*frontmatter* (`---` fences at the top of the file), unlike entities which use
fenced yaml blocks under headings.

## Referential integrity (validator-enforced)

- Every `sh-`/`dec-`/`proj-`/`drop-` reference must resolve within the client.
- `supersedes`/`superseded_by` must be reciprocal, and a superseded decision
  must have `status: superseded`.
- A tension with `status: resolved` must have `resolved` and (if a decision
  resolved it) `resolved_by` pointing at a real decision.
- A scope item's `state` must match the section (`## In`/`## Out`/`## Undecided`)
  it sits under.
- Every entity's `source`/`sources` drops must exist in `drops/`.

## Schema evolution

`schema_version` lives in `client.md`. Migrations are explicit `correction`
commits, never silent rewrites.
