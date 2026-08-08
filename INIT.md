# INIT — first run on a new machine

**Run this once**, on the machine where you'll work (macOS or Linux). It takes
you from a fresh clone to a verified install and the **first committed eval
baseline** — the score every future change to the extraction skills gets
measured against.

After that, day-to-day use is just opening the repo in Claude Code; you won't
need this file again.

---

## 1. Prerequisites

Everything is handled by the installer:

```bash
./setup.sh
```

It detects the platform and installs what's missing — **git ≥ 2.40** (commit
trailers are the event stream) and **ripgrep** (search) via Homebrew on macOS
or apt/dnf on Linux — checks **Node ≥ 20**, then runs `npm install`. It's
idempotent: safe to re-run any time.

**macOS notes**
- Install [Homebrew](https://brew.sh) first if you don't have it; the script
  will stop and tell you if it's missing.
- If Node is missing or old, install [nvm](https://github.com/nvm-sh/nvm) and
  run `nvm use` (an `.nvmrc` is committed) — the script won't install Node for
  you, deliberately, so it never fights your version manager.

## 2. Verify offline first — no API key, no cost

Do this before spending anything. It proves the machine is set up correctly:

```bash
npx vitest run --project unit      # parser, validator, commit-gate tests
npx vitest run --project corpus    # corpus integrity + the grader self-test
```

Both should be green. The corpus project is the interesting one: it replays a
scripted *perfect* ingest through the real graders and requires every metric to
score 1.0, then proves each metric catches its own failure mode. If that
passes, the harness itself is trustworthy.

## 3. API key

The eval harness spawns real agent runs, so it needs a key. Normal brain work
inside Claude Code does **not**.

```bash
cp .env.example .env
$EDITOR .env                       # set ANTHROPIC_API_KEY=sk-ant-...
set -a; source .env; set +a        # export it into this shell
```

The harness reads the **environment variable**, not the file — so if you open a
new terminal, re-run the `set -a; source .env; set +a` line (or use direnv).

## 4. Smoke run — cheap sanity check

```bash
npm run eval -- --smoke
```

Three drops (1, 7, 8 — a kickoff, a decision reversal, a stakeholder departure)
on Haiku with the judge off. A few minutes, cents not dollars.

What good looks like: each drop prints its turn count and cost, then a line like

```
  recall 1.00 · precision 1.00 · compliance 1.00
```

Scores below 1.00 here aren't a setup failure — they're the extraction skill
having a bad day on a hard drop, which is exactly what the harness exists to
measure. A crash, a missing key, or `compliance 0.00` across the board is a
setup problem.

## 5. First baseline

```bash
npm run eval -- --drops all --judge on --baseline
```

All 16 drops from scratch on Sonnet, with the prose judge on. Budget roughly an
hour of wall time and a few dollars — the exact figures land in the report.

Then check it against the regression floors and commit the result:

```bash
npx vitest run --project scores    # recall ≥0.9, precision ≥0.95, compliance 1.0
git add eval/reports/
git commit -m "eval: first baseline"
git push
```

`--baseline` writes a `eval/reports/<date>-<sha>.json` / `.md` pair. **Commit
it** — that's the whole point. Every later baseline diffs against the most
recent committed one, so the `.md` shows score deltas when you change a skill
prompt. The failure appendix at the bottom names the exact matcher, expected vs
actual value, and offending commit for every miss, so iteration is targeted
rather than guesswork.

If the score test fails, don't fix the test — read the appendix and fix the
ingest skill (or the golden, if the golden is wrong).

## 6. Iterating on the skills afterwards

State is cached per drop, so you don't re-run the world to test one change:

```bash
npm run eval -- --drops 7 --stale-ok    # re-run drop 7 from the cached after-06 state
```

The cache is keyed by a hash of the ingest skill + schema docs, so editing any
of them invalidates it — `--stale-ok` says "reuse the older snapshot anyway",
which is right for fast iteration and wrong for a baseline. **Baselines always
run from scratch.**

Deeper detail lives in [`eval/reports/README.md`](eval/reports/README.md).

## 7. Your first real client

Open the repo in Claude Code and just talk:

1. Mention a client that has no directory yet → **brain-init** scaffolds
   `clients/<slug>/` — capability, no context.
2. Paste a transcript, an email, or talk through a meeting → **brain-ingest**
   saves the raw input verbatim to `drops/`, extracts attributed findings, and
   commits **one commit per finding**.
3. `git log --oneline` — that history is the record of how understanding grew.
4. Later: "what changed since the kickoff?" → **brain-diff**; "prep me for a
   meeting with Sam" → **brain-recall**; "read me into this client" →
   **brain-onboard**.

## Troubleshooting

**`ANTHROPIC_API_KEY is required`** — the variable isn't exported in the current
shell. Re-run `set -a; source .env; set +a`.

**`No cached snapshot for after-NN`** — you asked for a mid-corpus drop without
having run the earlier ones. Either run from drop 1, or add `--stale-ok` to
reuse a snapshot from an older skill version.

**`Claude Code process exited with code 1` / "Invalid API key"** — the key is
missing or wrong. The harness spawns its own agent processes; they don't inherit
your interactive Claude Code login.

**Something looks half-installed** — just re-run `./setup.sh`; it's idempotent.

**A sandbox got left behind** — `eval/.sandbox/` and `eval/.cache/` are
git-ignored scratch space. Deleting them loses nothing but cached run state.
