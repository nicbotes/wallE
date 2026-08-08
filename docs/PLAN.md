# Client Brain — fresh repo build plan

## Context

The repo (nicbotes/wallE) holds a discarded experiment (EVE, a Next.js chat agent) plus a first sketch of a `clients/` structure. Wipe it entirely (orphan branch) and build **Client Brain**: the system that captures what a good human consultant carries in their head about a client org — who's who, incentives, per-stakeholder requirements, decisions and reversals, scope shifts, projects, incidents — as structured Markdown under git, durable over years, time-travelable, surviving any employee's departure.

Core loop: context drops (transcripts, delivery updates, incidents, personnel changes) → agent extracts attributed findings → **one commit per finding, automatic** → git log becomes a queryable event stream → skills answer "lay of the land", "what changed since X", "prep me for meeting Y", "onboard me".

Quality is first-class: a synthetic corpus with objectively identifiable golden facts + a TS eval harness measuring extraction accuracy and catching regressions when skill prompts change.

## Locked decisions (user-confirmed)

1. **Platform:** Claude Code, skills-first. The repo IS the product. No app/server.
2. **Eval stack:** TypeScript + `@anthropic-ai/claude-agent-sdk` (headless runs) + vitest (grading/regression) + `@anthropic-ai/sdk` (LLM judge).
3. **Storage:** Markdown + fenced YAML under git (settled vs RAG/graph — files win on curation, editability, diff-native time travel).
4. **Reset:** orphan branch, truly fresh history, force-push to `claude/client-context-transcripts-8ybpcv`.

## Design stance: three strictly separated layers

1. **Capability** — `.claude/skills/`, `schema/`, `tools/`. Corpus-agnostic; what a new client starts with ("capability, no context") and what eval sandboxes copy.
2. **Content** — `clients/`. Real brains. Ships empty.
3. **Quality** — `eval/`. Corpus, goldens, harness, committed score reports. Never loaded by the runtime agent (enforced by a leakage lint + sandboxes that exclude `eval/`).

## Event-sourcing model (explicit, load-bearing)

- **Event log = `clients/<slug>/drops/`.** EVERY raw input — transcript, email, Slack paste, incident report, spoken notes the user dictates — is saved **verbatim and immutable** as a drop file with stable ID (`drop-YYYY-MM-DD-<slug>`), typed frontmatter, and its own commit *before* any extraction. Never edited after commit. This is the ground truth and the future ingestion source for RAG/centralised doc stores.
- **Projections = the brain files.** stakeholders.md, decisions.md, etc. are curated views derived from the event log. Designed property: a brain is in principle **rebuildable by re-ingesting all drops in order** — the eval harness literally exercises this loop.
- **Changelog = git.** Trailered finding commits are the event stream of *understanding*; `query-log.ts` is its query interface.
- **Doc-store ready, not doc-store now.** Stable drop IDs + immutable content + frontmatter mean a later centralised store or vector index syncs by walking `drops/` — no migration needed. We deliberately do not build that store yet.

## Ephemeral derived layers (local, optional, rebuildable — leverage existing projects)

Source of truth is files+git, full stop. Anything else is a **git-ignored, disposable projection** under `.cache/` that can be rebuilt from drops at any time:

- **Lexical search now:** `tools/search.ts` — ripgrep over `drops/` + brain files with typed filters (client, date range, drop type). Covers the 90% case with zero infra; ships in Phase 1.
- **Vector search later (designed extension point, not built now):** `tools/index.ts` stub + a documented contract — embed drops into a local **sqlite-vec or LanceDB** index in `.cache/vectors/` (both embedded, no server, npm-installable), rebuildable from scratch; recall/ingest skills may consult it when a client's drop corpus outgrows context. Chosen over Chroma/servers to keep it disk-local and ephemeral.
- **Obsidian compatibility (free win for humans):** a client brain is a valid Obsidian vault — standard Markdown, headings, file-level frontmatter on drops. Document "open `clients/<slug>/` in Obsidian" in the README (graph view over stakeholders/decisions); `.obsidian/` goes in .gitignore. No wikilink dependency — entity IDs remain the canonical references.
- **Ecosystem posture (in README):** mem0/Zep/Letta-style agent memory and MCP markdown-memory servers (e.g. basic-memory) are consumers/alternatives at the derived layer, not the source of truth — our files can feed them; they never own the data.

## Cross-platform setup (macOS + Linux — the team runs both)

- **`setup.sh`** at repo root, idempotent: detects platform → installs external deps via **Homebrew** (macOS) or **apt/dnf** (Linux, with sudo detection and a clear manual-fallback message); verifies **Node ≥ 20** (points at nvm/fnm if missing, `.nvmrc` committed); then `npm install`. External deps are deliberately few: **git ≥ 2.40** (trailer support) and **ripgrep** (search.ts). Everything else is npm-local (tsx, vitest, yaml, agent-sdk, sqlite-vec/LanceDB later — chosen partly because both ship prebuilt binaries for mac/Linux, no compiler toolchain needed).
- **README "Install" section**: one table (dependency / macOS command / Linux command / why), then `./setup.sh && npm run eval -- --smoke` as the smoke test that the machine is ready. CI-free by design — the eval harness is the check.

## Repo tree

```
CLAUDE.md                    # repo charter: what this is, core rules, skill pointers
README.md                    # quickstart: install (mac+linux), new client in 5 min; run evals
docs/PLAN.md                 # THIS PLAN, committed to the repo (first commit of P0)
setup.sh                     # idempotent cross-platform dependency installer (brew | apt/dnf)
.nvmrc
package.json tsconfig.json vitest.config.ts .gitignore .env.example
.claude/
  settings.json              # allow Bash(git*, npx tsx tools/*); deny WebFetch/WebSearch
  skills/{brain-init,brain-ingest,brain-recall,brain-diff,brain-audit,brain-onboard}/SKILL.md
schema/
  SCHEMA.md                  # normative: file set, entity YAML fields, ID rules, principles
  FINDINGS.md                # finding taxonomy + commit trailer spec
  templates/client/          # copied verbatim by brain-init (incl. projects/_template/)
tools/
  lib/{parser.ts,types.ts,trailers.ts}   # ONE parser shared by validator and graders
  validate.ts                # schema errors, dangling refs, broken supersedes chains, unattributed reqs
  query-log.ts               # git log → JSON finding stream (--client --since --type --entity --source)
  staleness.ts               # entities with last_confirmed older than --months N
  search.ts                  # ripgrep-backed search over drops + brains (client/date/type filters)
  index.ts                   # STUB + contract doc: local vector index in .cache/ (sqlite-vec/LanceDB), later
  commit-finding.sh          # THE commit gate: stages named files only, builds trailered message
clients/.gitkeep
eval/
  corpus/meridian-energy/{manifest.yaml, drops/01..16-*.md, goldens/after-01..16.yaml, goldens/entities.yaml}
  src/{cli.ts,sandbox.ts,runner.ts,goldens.ts,metrics.ts,report.ts, grade/{deterministic.ts,gitlog.ts,judge.ts}}
  tests/{corpus-integrity.test.ts, ingest-scores.test.ts}
  reports/                   # committed baselines: YYYY-MM-DD-<sha>.{json,md}
```

## Brain schema

### Layout per client — org-level facts at root (people outlive projects), delivery facts per project

```
clients/<slug>/
  client.md                  # profile, engagement map, reading order, schema_version
  stakeholders.md  incentives.md  tensions.md  decisions.md   # org-level; tensions span projects
  drops/YYYY-MM-DD-<slug>.md                                  # THE EVENT LOG: every raw input, verbatim, immutable
  projects/<proj>/{project.md, scope.md, requirements.md, decisions.md, log.md}
```

### Entity encoding
Every entity = `## <Display Name> (<id>)` heading + one fenced ```yaml block (structured fields) + free prose. Files stay human-readable end-to-end; `tools/lib/parser.ts` only needs "headings + first yaml fence"; diffs stay local to the entity touched.

### IDs — immutable forever; renames are supersessions/updates, never ID edits
- Deterministic (goldens match exactly): stakeholder `sh-<given>-<family>` (collision → `-2`), project `proj-<slug>`, drop `drop-YYYY-MM-DD-<slug>`.
- Agent-chosen slug (goldens match semantically): `dec-YYYYMMDD-<slug>`, `req-<slug>`, `ten-<slug>`, `inc-<sh>-<slug>`, `scp-<slug>`.
- Finding = the commit SHA; git is the findings registry.

### Key fields (normative list in SCHEMA.md)
- **Stakeholder:** id, name, role, org_unit, status active|departed, disposition champion|supportive|neutral|skeptical|blocker|unknown, influence, reports_to?, projects[], first_seen, last_confirmed, sources[].
- **Incentive:** stakeholder, kind stated|inferred, confidence, source, last_confirmed + prose.
- **Decision:** date, status active|superseded, decided_by[], supersedes?, superseded_by?, source. Append-only; supersession edits exactly two fields on the old entry + adds the new one.
- **Requirement:** stated_by (sh-id | unattributed = flagged gap), date, status active|delivered|dropped|superseded, priority, source, last_confirmed.
- **Tension:** status open|resolved, between[], opened, resolved?/resolved_by? (dec-id).
- **Scope item:** state in|out|undecided, since, decided_by?, source (movement history lives in git).
- **Log entry:** kind update|incident|milestone, date, source, involves[].
- **Drop frontmatter:** id, date, type meeting|workshop|email|slack|incident|update|note, title, participants (verbatim), ingested. Body = raw input, never edited after commit.

Principles restated in SCHEMA.md for skills to cite: attribute everything or mark inferred; hold contradictions (log a tension, don't pick a winner); never delete (supersede); `last_confirmed` drives staleness.

## Finding taxonomy + commit protocol

Types: `brain-init`, `drop` (raw input saved verbatim — always the first commit of an ingest), `stakeholder-new|update` (incl. departure), `incentive-new|update`, `requirement-new|update`, `decision-new`, `decision-superseded` (new entry + stamp on old = ONE commit), `scope-move`, `tension-opened|resolved`, `project-new|update`, `confirm` (ALL last_confirmed bumps from one drop batched into ONE commit — noise control), `correction` (fix a prior extraction error, Refs: the bad commit).

Commit format — subject + git trailers (queryable via `git log --format='%(trailers:...)'`):

```
decision-superseded(meridian-energy): move to managed cloud Postgres

Client: meridian-energy
Project: proj-billing-replatform      # omit for org-level
Finding: decision-superseded
Entity: dec-20240730-managed-cloud
Refs: dec-20240214-selfhost-postgres  # optional related IDs
Attributed-To: sh-marcus-webb         # optional
Source: drop-2024-07-30-steering
```

`Client/Finding/Entity/Source` mandatory. **`tools/commit-finding.sh`** is the gate: validates type, stages ONLY named files, assembles message, commits. Skills always commit through it; the gitlog grader is the backstop.

Ingest ordering per drop: drop commit (raw input) → findings in dependency order (stakeholders before things attributed to them; decisions before tensions they resolve) → one confirm commit. All share `Source:` so `query-log.ts --source <drop>` reconstructs a drop's full impact.

## Skills (all read SCHEMA.md + FINDINGS.md first; never delete history)

1. **brain-init** — new client from template; fill client.md from known context (mark unknowns unknown); single `brain-init` commit. "Capability, no context."
2. **brain-ingest** (core, most-iterated) — identify client (init if new, ask if ambiguous); establish drop date from content (ask, never silently default to today for historical material); save the raw input verbatim to `drops/` + commit (whatever its form — transcript, email, pasted notes, dictated context); read current state of plausibly-touched files; draft a findings ledger BEFORE editing (resolving names against existing stakeholders — if "Tom" is ambiguous, log an open question rather than guess); apply one finding → one commit-finding.sh call, in dependency order; confirm batch; run validate.ts (fix via `correction` commits); narrate findings with short SHAs + what was deliberately NOT recorded and why.
3. **brain-recall** — lay of the land / who-is / project state / meeting prep (disposition + trajectory via `query-log --entity`, incentives stated-vs-inferred, their requirements, tensions they're party to, decisions affecting them in last 90 days). Cites entity IDs + source drops; flags stale facts (>6 months). Read-only.
4. **brain-diff** — resolve anchor → `query-log --since` → narrate was→is, lead with supersessions and disposition shifts, end with tensions opened/resolved. Read-only.
5. **brain-audit** — validate.ts (mechanical) + staleness.ts + judgment pass (contradictions present in files but missing from tensions/). Report grouped mechanical/stale/judgment; fixes only with user approval, via `correction` commits.
6. **brain-onboard** — "read me in in 30 min" (chat output, not a file): org snapshot; top-5 stakeholders by influence; active projects + phase; the 3–5 shaping decisions **with supersession backstory** (reversals = highest-signal history); open tensions; last-90-days delta; explicit stale/uncertain section; suggested reading order.

## Eval corpus: Meridian Energy (fictional utility, Jan 2024 – Nov 2025)

Cast: Priya Sharma (VP Eng, champion), Marcus Webb (CFO, skeptical/cost-driven), Dana Okafor (Head of Billing Ops, risk-averse), Tom Nagel (arrives drop 8, later CTO), Aisha Bell (Head of CX, drop 11). Drops are authored so every golden fact is objectively extractable, wrapped in realistic noise — including deliberate red herrings that must NOT become findings (feeds precision grading).

16 drops: 01 kickoff (proj-billing-replatform, 3 stakeholders, initial scope) · 02 requirements workshop (attributed reqs + red-herring vendor mention) · 03 architecture review (dec self-hosted Postgres; ten budget-vs-speed) · 04 delivery update (confirm-batching test) · 05 workshop (contradictory Dana-vs-Marcus cutover demands → tension) · 06 incident (outage; scope-move; incentive confidence bump) · 07 steering (**decision reversal**: managed cloud supersedes 03) · 08 **Priya departs**, Tom arrives skeptical · 09 scope cut (mobile payments → out; req dropped) · 10 year-end (phase change; Tom's stated incentive) · 11 **second project** portal + Aisha + cross-project tension over shared API team · 12 **restructure** (Tom permanent CTO, disposition shift, reports_to changes) · 13 **email-type drop** (cross-project requirement) · 14 incident + SSO decision · 15 workshop (**tension resolved by** phased-cutover decision) · 16 exec review (project delivered; req delivered; new undecided scope).

## Goldens + grading

`goldens/after-NN.yaml` = cumulative expected state. **Matcher system** (the mechanism that makes goldens robust to agent-chosen IDs): exact `{id}` where deterministic; `{file?, date?, keywords_any}` otherwise; `as:`/`ref:` bindings let supersedes-chains and tension→decision links be asserted on resolved IDs. Matcher → 0 entities = recall miss; → >1 = hard grader error (fix the golden). `entities.yaml` = per-index allowlist of every legit entity → **precision** = nothing structured exists outside it.

Metrics per drop: **fact_recall**, **precision**, **attribution_accuracy**, **supersession_correctness**, **commit_compliance** (mandatory trailers, valid types, drop-commit-first, commit touches only its entity's file(s), confirm batching, validate.ts exit code). **Judge** (direct `@anthropic-ai/sdk`, pinned cheap model, temp 0, binary rubrics ≤2/drop, strict JSON, optional 3-vote majority) covers prose quality only and is reported separately — never blended into deterministic aggregates.

## Harness mechanics

- **sandbox.ts** — per run in `eval/.sandbox/<runid>/`: copy CLAUDE.md, `.claude/`, `schema/`, `tools/`, package files; symlink host `node_modules`; `git init` + base commit. **Corpus/goldens are never copied in** — drop text is injected via prompt, so the agent physically cannot peek. `settingSources: ['project']` for config hermeticity.
- **runner.ts** — one Agent SDK `query()` per drop: prompt = "Ingest this drop for Meridian Energy" + date/type + drop text; `cwd: sandbox`; tools allowed Read/Write/Edit/Glob/Grep/Bash/Skill, disallowed WebSearch/WebFetch/Task; maxTurns 80; capture usage/cost. ⚠️ Runs with `permissionMode: 'bypassPermissions'` — justified because the sandbox is disposable, tool-restricted, and network-denied; flagging explicitly since it's a security-relevant choice.
- **Caching/resume** — after each drop: `git tag eval/after-NN` + snapshot to `eval/.cache/`, keyed by skillhash (sha256 of ingest SKILL.md + SCHEMA.md + FINDINGS.md). `--drops 7` restores after-06 (requires `--stale-ok` if skillhash changed). `--smoke` = drops 1,7,8 on haiku, judge off — the cheap pre-commit check. Baselines always run from scratch.
- **Tests** — `corpus-integrity.test.ts` (offline): goldens parse, refs resolve, dates monotonic, **leakage lint** (grep `.claude/` + `schema/` for corpus proper-noun stoplist). `ingest-scores.test.ts`: asserts metric floors (recall ≥0.9, precision ≥0.95, compliance = 1.0) against `eval/.runs/latest.json`; skips cleanly when absent.
- **report.ts** — `eval/reports/YYYY-MM-DD-<sha>.{json,md}` committed after baselines: per-drop + aggregate metrics, cost, wall time, **delta vs previous report**, and a per-failure appendix (matcher, expected, actual, offending commit SHA) so skill iteration is targeted.

## Build order (verify each phase before the next)

- **P0 Reset + skeleton:** orphan branch, wipe; **first commit = this plan as `docs/PLAN.md`** (pushed immediately so the plan lives in the repo); then CLAUDE.md/README/setup.sh/.nvmrc/package/tsconfig/vitest/.gitignore. ✓ `./setup.sh` succeeds on this Linux box; `npm i`, vitest green (0 tests).
- **P1 Schema + tools:** SCHEMA.md, FINDINGS.md, templates, tools/lib, validate, query-log, staleness, search.ts (ripgrep), index.ts stub + contract, commit-finding.sh + unit tests on a hand-authored fixture brain. ✓ unit tests green; commit gate exercised in a scratchpad git dir.
- **P2 brain-init + brain-ingest:** ✓ manual session in a scratch clone: init fake client, ingest a hand-written (non-corpus!) drop, inspect trailers, validate — then discard.
- **P3 Corpus + goldens:** manifest, 16 drops (author drop + its golden together), entities.yaml, integrity test. ✓ integrity + leakage lint green.
- **P4 Harness (deterministic):** sandbox/runner/goldens/graders/metrics/report/cli. ✓ `npm run eval -- --drops 1-3`; iterate ingest skill until recall ≥0.9 / compliance 1.0 on those drops.
- **P5 Judge + baseline:** judge.ts; full run `--drops all --judge on`; commit first baseline report. ✓ ingest-scores green.
- **P6 Remaining skills:** recall/diff/audit/onboard. Light evals: ~6 recall questions vs cached after-16 state (graded by required-entity-ID presence + 1 rubric each); audit gets a poisoned-fixture test validate.ts must fully flag. ✓ smoke + manual sessions.
- **P7 Polish + ship:** README quickstart (incl. Obsidian-vault usage + derived-layers posture), final baseline, force-push orphan history to `claude/client-context-transcripts-8ybpcv`.

## Risks & mitigations

- **Commit-per-finding noise** → confirm batching; query-log turns volume into an asset; compliance grading forbids both mega-commits and pathological splitting.
- **Judge flakiness** → deterministic-first; binary rubrics; temp 0; pinned model; separate reporting.
- **Corpus leakage into skills** → corpus-agnostic capability layer; automated leakage lint; sandbox excludes eval/.
- **ID nondeterminism vs goldens** → deterministic IDs where derivable; matcher+binding elsewhere; >1-match = fix-the-golden error.
- **Agent freelancing on layout** → templates ship exact headings; SCHEMA.md normative; validate.ts at end of every ingest; grader parses structure.
- **Cost/runtime** → smoke preset; cached resume; cost in every report.
- **Schema evolution** → schema_version in client.md; migrations are explicit `correction` commits.

## Verification (end-to-end)

1. `npm run eval -- --smoke` → sandbox ingest runs headless, prints scores.
2. Full baseline: `eval/reports/<date>-<sha>.md` committed with recall/precision/attribution/supersession/compliance at or above floors.
3. Manual: open repo in Claude Code → init a real client → ingest a real note → per-finding commits + narration → `brain-diff` narrates the delta → `brain-onboard` reads a newcomer in.
