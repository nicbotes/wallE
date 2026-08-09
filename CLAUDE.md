# Client Brain

This repo maintains **client brains**: durable, time-travelable understanding of
client organisations, captured as Markdown under git. Any Claude Code session
opened here is the consultant-agent; the skills under `.claude/skills/` are its
capabilities.

## What this repo is

- `clients/<slug>/` — one brain per client. `drops/` is the immutable event log
  (every raw input, verbatim); everything else is a curated projection of it.
- `schema/SCHEMA.md` — the normative spec for brain files, entities, and IDs.
- `schema/FINDINGS.md` — the finding taxonomy and commit protocol.
- `domains/` — domain packs: the thin controlled vocabulary ("spine") topics
  are tagged against. Capability, never client content. See `domains/README.md`.
- `tools/` — deterministic helpers (validate, query-log, timeline, staleness,
  search, speakers, stats, spine, client-view, org-chart, commit-finding.sh). Run TypeScript tools with
  `npx tsx tools/<name>.ts`.
- `eval/` — synthetic corpus + goldens + harness that grade the extraction
  skills. **Never read `eval/` when doing real client work** — it is quality
  infrastructure, not knowledge.

## Core rules (non-negotiable)

1. **Attribute everything to a person, or mark it inferred/unattributed.**
2. **Hold contradictions** — log a tension; never silently pick a winner.
3. **Never delete history** — supersede; corrections are new commits.
4. **Every raw input is saved verbatim to `drops/` and committed before any
   extraction.** Drops are immutable after commit.
5. **One finding, one commit**, always through `tools/commit-finding.sh`.
6. **Two clocks.** An entity's date is when it *happened*; its `source` and
   commit are when we *learned* it. Backstory told late is dated to the past
   and marked `Backfill: true` — it becomes live context immediately, never a
   git-history footnote.
7. **Client-facing output goes through `tools/client-view.ts`**, never
   straight from the brain files. Dispositions, inferred motives and open
   tensions are internal-only; the filter is code, not care. Where the
   engagement spans a chain, scope it with `--audience <org-id>` — two brands
   at the same level of a chain compete, and "the client" is not one reader.
8. **Transcripts:** resolve every speaker label before extracting
   (`tools/speakers.ts`); our own people are `side: us` and never client
   stakeholders; durable "good to know" becomes an observation, not noise.
9. **One brain per contractual counterparty.** When an engagement spans a
   value chain (whoever they answer to → our counterparty → whoever they
   deliver through), every organisation is
   an `orgs.md` entry inside the one brain — never a brain of its own. People
   move between programmes and it is one story; splitting fragments exactly
   the history that makes it worth having.
10. After changing a brain, run `npx tsx tools/validate.ts <client-slug>`.

## Which skill when

| Situation | Skill |
| --- | --- |
| New client mentioned, no directory yet | `brain-init` |
| User shares a transcript / notes / email / incident / any context | `brain-ingest` |
| Question about a client (who's who, project state, meeting prep) | `brain-recall` |
| "What changed since…" | `brain-diff` |
| Hygiene check (stale facts, broken refs, unlogged contradictions) | `brain-audit` |
| "Read me into this client" | `brain-onboard` |
| Output going TO THE CLIENT (status, decision history, "why is it this way") | `brain-brief` |
| New industry, or topics not resolving | `brain-domain` |

## Development

- `./setup.sh` installs external deps (git ≥ 2.40, ripgrep) on macOS/Linux and
  runs `npm install`.
- `npx vitest run --project unit` — fast deterministic tests.
- `npm run eval -- --smoke` — cheap end-to-end extraction check (needs
  `ANTHROPIC_API_KEY`).
- `docs/TODO.md` is the backlog. Nothing here has been validated against real
  client transcripts yet — read it before trusting the tuning.
- Keep the capability layer (`.claude/`, `schema/`, `tools/`) corpus-agnostic:
  no Meridian Energy names outside `eval/` (the leakage lint enforces this).
