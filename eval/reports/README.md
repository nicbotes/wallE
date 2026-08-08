# Baseline reports

Committed score reports from full corpus runs. Each pair
(`YYYY-MM-DD-<sha>.json` / `.md`) is one baseline: aggregate + per-drop
metrics, cost, and a per-failure appendix. `report.ts` diffs each new baseline
against the previous one, so skill-prompt changes show their score delta here.

## Producing a baseline

Needs an `ANTHROPIC_API_KEY` (the harness spawns real agent runs — roughly
16 ingests on the run model plus a few cheap judge calls; expect it to take
in the order of an hour of wall time and a few dollars):

```bash
cp .env.example .env            # set ANTHROPIC_API_KEY
set -a; source .env; set +a
npm run eval -- --drops all --judge on --baseline
npx vitest run --project scores # regression gate against the floors
git add eval/reports && tools/… # commit the report pair via a normal commit
```

Cheap iteration while editing the ingest skill:

```bash
npm run eval -- --smoke                 # drops 1,7,8 on haiku, judge off
npm run eval -- --drops 7 --stale-ok    # re-run one drop from cached state
```

No baseline exists yet: the repo was built in an environment without API
credentials. The grader self-test (`vitest --project corpus`) proves the
pipeline end-to-end with a scripted perfect agent; the first real baseline is
a one-command local task.
