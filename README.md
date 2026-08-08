# Client Brain 🧠

**A durable, time-travelable understanding of each client — built the way a
great consultant builds it in their head, but living in files under git so it
survives beyond any employee.**

Consultants differentiate by carrying a map of the client org: who's who, what
each stakeholder actually wants, which decisions were made (and reversed),
where scope moved, where the tensions are. That map usually walks out the door
with the person. This repo captures it instead:

- **Event log** — every raw input (meeting transcript, email, incident report,
  dictated notes) is saved verbatim and immutably under `clients/<slug>/drops/`.
- **Projections** — agent skills extract *attributed findings* into curated
  Markdown (stakeholders, incentives, requirements, decisions, tensions, scope).
- **Changelog** — every finding is its own git commit with machine-parseable
  trailers. `git log` *is* the story of how understanding evolved; diffs show
  changes in thinking, not just changes in text.
- **Quality** — a synthetic corpus with golden facts and an eval harness keep
  the extraction skills honest and catch regressions when prompts change.

## Install (macOS + Linux)

| Dependency | macOS | Linux | Why |
| --- | --- | --- | --- |
| git ≥ 2.40 | `brew install git` | `apt-get install git` / `dnf install git` | commit trailers = the event stream |
| ripgrep | `brew install ripgrep` | `apt-get install ripgrep` / `dnf install ripgrep` | fast search over drops & brains |
| Node ≥ 20 | `nvm use` (see `.nvmrc`) | `nvm use` (see `.nvmrc`) | tools + eval harness |

Or just:

```bash
./setup.sh          # installs the above (brew | apt/dnf) + npm install
```

## Use it (inside Claude Code)

Open this repo in Claude Code. The skills load automatically:

1. Mention a new client → **brain-init** scaffolds `clients/<slug>/`.
2. Paste a transcript, email, or just talk through a meeting → **brain-ingest**
   saves the raw drop, extracts findings, commits each one.
3. Ask "what's the lay of the land at Acme?" → **brain-recall**.
4. Ask "what changed since March?" → **brain-diff**.
5. "Read me into this client" → **brain-onboard** (the 30-minute newcomer path).
6. Periodic hygiene → **brain-audit** (stale facts, broken chains, unlogged
   contradictions).

A new client starts with **capability but no context** — understanding grows
drop by drop, and every step of that growth is a commit you can revisit.

## Quality: evals

The extraction skills are graded, not vibes-checked. `eval/corpus/` contains a
fictional client (**Meridian Energy**, 2 simulated years, 16 drops: kickoffs,
reversals, departures, incidents, restructures) authored so every expected fact
is objectively identifiable. The harness replays drops through the real ingest
skill in a hermetic sandbox and grades the resulting brain + git log:

```bash
cp .env.example .env                # set ANTHROPIC_API_KEY
npm run eval -- --smoke             # cheap check: 3 drops, no judge
npm run eval -- --drops all --judge on   # full baseline
npx vitest run --project unit       # deterministic tool tests (no API key)
```

Reports land in `eval/reports/` with per-metric scores (fact recall, precision,
attribution, supersession, commit-protocol compliance) and a failure appendix,
so skill-prompt changes show their score delta.

## Derived layers (optional, always rebuildable)

Files + git are the only source of truth. Everything else is a disposable
projection you can rebuild from `drops/`:

- **Search now:** `npx tsx tools/search.ts` (ripgrep-backed).
- **Vector search later:** `tools/index.ts` documents the contract for a local
  embedded index (sqlite-vec / LanceDB) under `.cache/` — deliberately not
  built yet.
- **Obsidian:** any `clients/<slug>/` folder opens as a valid Obsidian vault
  for humans who want graph views. `.obsidian/` is git-ignored.
- Agent-memory systems (mem0/Zep/Letta, MCP markdown-memory servers) can
  *consume* these files; they never own the data.

## Layout

```
CLAUDE.md            operating instructions for the agent
docs/PLAN.md         the full build plan & design rationale
schema/              SCHEMA.md (entities, IDs) · FINDINGS.md (commit protocol) · templates/
.claude/skills/      brain-init · brain-ingest · brain-recall · brain-diff · brain-audit · brain-onboard
tools/               validate · query-log · staleness · search · commit-finding.sh
clients/             one brain per client (ships empty)
eval/                corpus · goldens · harness · committed score reports
```
