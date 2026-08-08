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

## Topics: a thin controlled spine over free-form tagging

Entities that have a *subject* — observations, decisions, requirements,
tensions, scope items — carry `topics: []`. A topic takes one of two forms, and
the difference is enforced:

| Form | Example | Rule |
| --- | --- | --- |
| `facet:term` | `component:coverage` | **Controlled.** Must resolve against a domain pack attached to this brain, or the validator errors. |
| bare slug | `renewal-pricing-quirk` | **Free-form.** Always valid. These are promotion candidates. |

Which packs apply is declared in `client.md` as `domains: [insurance]`. The
packs themselves live in `domains/` and are **capability, not client content** —
the vocabulary a consultant learns before meeting anyone. See
`domains/README.md` for the format and the promotion path; `tools/spine.ts` is
the CLI (`list`, `resolve`, `candidates`).

The point of the split: controlled topics give cross-client comparability
("every client who hit this in migration"), free-form topics stop the scheme
from rotting the moment reality outruns it, and `spine.ts candidates` turns
recurring free-form topics into evidence for extending a pack.

**Never force a topic that isn't obvious.** An absent tag costs a little
recall; a wrong one makes a search look complete when it isn't, which is worse.

## Two clocks: event time vs knowledge time

Understanding arrives out of order. Someone explains in today's meeting why IT
has distrusted us since a failed migration three years ago; a client hands over
an archive of old decision records. That is **backfill**, and the brain models
it with two independent clocks:

| Clock | Where it lives | Answers |
| --- | --- | --- |
| **Event time** | the entity's own `date` / `opened` / `since` / log heading, and a drop's `date` | *When did this happen?* |
| **Knowledge time** | the entity's `source` (+ `sources`), the drop's `ingested`, and the commit itself | *When did we learn it?* |

Consequences that everything else follows from:

- **An entity's event date may be far earlier than the drop that taught us.**
  A decision made in 2022 and first described to us in 2026 is
  `date: 2022-…`, `source: drop-2026-…`. That is correct and expected, not a
  data error.
- **Event date may never be later than its source drop's date** — you cannot
  learn about something that has not happened. The validator enforces this.
- **Backfilled context is current context.** It lands in the projections
  (`stakeholders.md`, `decisions.md`, …) exactly like anything else, so
  `brain-recall` and `brain-onboard` draw on it immediately. Git history
  records only *when we learned it*; nobody should have to read git to know the
  backstory.
- **Files are ordered by event time, not arrival time.** Backfilled entries are
  inserted in date order among their peers — the decision log and delivery log
  read as chronologies. (Append-only refers to never deleting, not to always
  writing at the bottom.)
- **`first_seen` is the earliest drop by event date that mentions the person.**
  Backfilling an older drop that features an existing stakeholder corrects it
  via `stakeholder-update`.
- **`last_confirmed` is knowledge time, but only for present-tense claims.** A
  drop that asserts a fact still holds bumps it to the drop's date. A drop
  merely recounting history ("back then we decided X") does *not* — it tells us
  about the past, not the present.

Two ways backfill arrives, handled differently:

1. **A historical artifact** (an old email, an archived decision record). It is
   its own drop, dated when it was *written* — `date: 2021-…`, `ingested:
   2026-…`. Drops need not be ingested in date order.
2. **History recounted in a current conversation.** The drop is dated *today*
   (that meeting really did happen today); the entities extracted from it carry
   their own, older event dates.

## Layout per client

```
clients/<client-slug>/
├── client.md            # profile, engagement map, reading order
├── stakeholders.md      # org-level: people outlive projects (client + our side)
├── incentives.md        # org-level: stated vs inferred motives
├── observations.md      # org-level: durable "good to know" context
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
| Observation | `obs-<slug>` | slug chosen at write time |
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
side: client                    # client | us | partner  (default: client)
aliases: ["Ada", "Ada V.", "ada.vance@acme.example"]   # transcript labels & emails
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

**`side`** keeps the client map honest. Meeting transcripts contain our people
too; they are recorded with `side: us` (who owns the relationship, who heard
what) but are **never** counted as client stakeholders — `brain-recall` and
`brain-onboard` filter them out of stakeholder counts, top-N lists and meeting
prep. `partner` is for third parties (another vendor, an auditor).

**`aliases`** is how speaker labels resolve. The same person appears as "Ada",
"Ada Vance", "Ada V. (Acme)" and an email address across different transcripts;
every label we have seen for them goes here, so the next transcript maps
cleanly. `tools/speakers.ts` reports which labels in a drop are still unmapped.

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

### Observation (`observations.md`)

The home for durable "good to know" context that is not a decision, requirement,
tension or scope item — the texture that makes someone effective in the room.

```yaml
id: obs-budget-cycle-locks-march
about: org                      # org | <sh-id> | <proj-id>
kind: process                   # context | relationship | process | preference | constraint
confidence: high                # high | medium | low
source: drop-2024-02-02-requirements
last_confirmed: 2024-02-02
```

Prose: the observation itself, in enough detail to act on.

Use it for things like: their budget cycle locks in March; two stakeholders
worked together at a previous employer; this CFO always opens with run-rate;
procurement requires three quotes over £50k; the ops team distrusts the tool
they're mandated to use.

Do **not** use it as a dumping ground. An observation earns its place if it
would change how a colleague behaves in a meeting six months from now.
Everything else is chatter and stays in the drop, which is preserved verbatim
anyway. Never record personal or sensitive detail (health, family, private
circumstances) or disparaging characterisations of people.

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
domains: [insurance]            # ? packs in domains/ whose spines apply here
```

Prose: what the org is, the engagement map, and a **Reading order** section
telling a newcomer which files to read in what sequence.

### Drop (file-level frontmatter in `drops/*.md`)

```yaml
id: drop-2024-01-08-kickoff
date: 2024-01-08
source_tool: fathom              # ? fathom | gemini | otter | zoom | manual | other
type: meeting                   # meeting | workshop | email | slack | incident | update | note | transcript
title: Kickoff — billing replatform
participants: [Ada Vance, Bo Reyes]   # speaker labels VERBATIM as they appear
ingested: 2026-08-08            # date the drop was ingested
```

Body: the raw input, verbatim. Never edited after commit. Drops use YAML
*frontmatter* (`---` fences at the top of the file), unlike entities which use
fenced yaml blocks under headings.

`type: transcript` marks raw ASR output (Fathom, Gemini, Otter…) as distinct
from `meeting` notes a human wrote. It matters downstream: speech-to-text
mangles names and jargon, so quotes from a transcript are approximate, and any
auto-generated summary the tool prepends is *derived* content that can be
wrong. `participants` holds the speaker labels exactly as the tool emitted
them — resolving those to people is the stakeholder `aliases` field's job.

## Referential integrity (validator-enforced)

- Every `sh-`/`dec-`/`proj-`/`drop-` reference must resolve within the client.
- `supersedes`/`superseded_by` must be reciprocal, and a superseded decision
  must have `status: superseded`.
- A tension with `status: resolved` must have `resolved` and (if a decision
  resolved it) `resolved_by` pointing at a real decision.
- A scope item's `state` must match the section (`## In`/`## Out`/`## Undecided`)
  it sits under.
- Every entity's `source`/`sources` drops must exist in `drops/`.
- An observation's `about` must be `org`, a known stakeholder, or a known
  project.
- A stakeholder alias may not be claimed by two different people — ambiguous
  speaker labels must be disambiguated, not double-assigned.
- **No entity's event date is later than its source drop's date** (you cannot
  record what has not happened yet). Much *earlier* is fine — that is backfill.
  Something not yet decided is a tension/open question, not a future-dated
  decision.
- A drop's `ingested` date is never earlier than its `date`.

## Schema evolution

`schema_version` lives in `client.md`. Migrations are explicit `correction`
commits, never silent rewrites.
