# Contributing

This file is written for **an AI agent filing an issue upstream**, because that
is the common case: you are working inside a client's brain, you hit a defect or
a gap in the capability, and it needs reporting to the shell repo. Humans should
read it too — the rule is the same either way.

## What this repo is

Client Brain ships **capability, never context**:

| Layer | Lives | Public |
| --- | --- | --- |
| Capability — `.claude/`, `schema/`, `tools/`, `domains/` | here | **yes** |
| Content — the brains built with it | your own deployment | no |
| Quality — `eval/` | here (synthetic corpus only) | yes |

A brain is one of the most sensitive artefacts an engagement produces. It holds
our read on named individuals, what we think motivates them, who is blocking
whom, and what a client is paying for. This repo is public. Those two facts give
one rule.

## The rule

**Nothing that identifies a client, a person, an engagement, or an industry may
appear in an issue, a pull request, a commit message, a test, or a fixture.**

Two lints already enforce the second half on the code itself
(`eval/tests/corpus-integrity.test.ts`): the capability layer may not contain
eval-corpus proper nouns, and it may not contain industry vocabulary — that
belongs in `domains/`. Your issue is held to the same standard.

If you cannot describe the problem without naming something real, that is a
signal you have not yet found the general form of the bug. Keep going; the
general form is what the maintainers can actually fix.

## What counts as leakage

The obvious ones: client names, company names, people's names, project names,
sector, product names, verbatim transcript text.

The ones that get missed:

- **Entity identifiers encode names.** `sh-ada-vance` *is* a person's name.
  `org-northwind-capacity` is a company.
- **Drop identifiers encode a date and a subject.** `drop-2024-07-18-steering`
  says you met that day, about that.
- **Pasted tool output.** `validate.ts` errors carry entity ids; stack traces
  carry `/Users/<name>/clients/<client>/…`; `git log` output carries trailers
  full of both.
- **The specific combination.** *"A three-tier chain where the top layer can
  veto on compliance grounds"* is the generic shape, and is fine. Naming the
  organisation, the sector, or the thing being vetoed is not — each of those
  alone can identify the engagement to anyone who knows the market.
- **A vocabulary proposal argued from a real sentence.** The proposal is
  welcome; the sentence is evidence from a client meeting.
- **Email addresses**, which are frequently stakeholder `aliases`.
- **Screenshots.** Nothing gets read less carefully before being attached.

## Turning a real failure into a safe report

This is the whole procedure. It is not redaction — do not write a real report
and then black things out, because that reliably leaves the shape of the thing
behind. Rebuild it.

1. **Name the mechanism, not the story.** "A tension whose `positions` reference
   a stakeholder outside `between` is accepted by the validator" — no client
   needed to say that.
2. **Reproduce it on the shipped fixtures.** `tools/__fixtures__/clients/testco`
   (clean) and `brokenco` (every violation class) are public and already
   exercise the machinery. A repro that runs against them is safe by
   construction *and* immediately actionable:
   ```bash
   npx tsx tools/validate.ts testco --clients-dir tools/__fixtures__/clients
   ```
3. **If the fixture cannot express it, that is part of the finding.** Say what
   the fixtures are missing and propose the addition, in neutral terms.
4. **Reuse the established neutral vocabulary** so reports stay consistent and
   safe: `acme-utilities`, `testco`, `brokenco`; Ada Vance, Bo Reyes; parent
   group / operating company / channel partner. Never invent a name that
   resembles a real one.
5. **Run the checker** (below).
6. **Read it once more as a stranger.** Could someone learn from this who our
   clients are, what sector they are in, or what they are buying? If yes, it is
   not ready.

## Check before you file

```bash
npx tsx tools/issue-check.ts draft.md            # in a deployment with brains
cat draft.md | npx tsx tools/issue-check.ts -
```

It compares your draft against **every name, alias and identifier in the brains
it can see**, plus the shared domain-vocabulary list and shapes like email
addresses and timestamped transcript lines. Exit 1 means do not file.

Two honest limits:

- **Run it where the brains are.** In a clean checkout of this shell there are
  no brains to compare against, so only the vocabulary and shape rules apply.
  It says so rather than reporting a reassuring zero — treat that output as
  "barely checked", not "clean".
- **A pass is not a guarantee.** It matches known strings and known shapes. It
  cannot recognise a paraphrase, an unusual requirement that identifies a client
  to anyone who knows the market, or a story that is recognisable without any
  names in it. You remain responsible for that judgement.

## Issue shapes

**Bug** — capability behaves incorrectly.
State expected vs actual, the exact command against a fixture, and, if you can,
which test would have caught it. A failing test case in the issue body is the
single most useful thing you can provide.

**Capability gap** — something a brain cannot express.
Describe the *shape* of what is unrepresentable and what a consultant loses
without it. Do not describe the client that made you notice. Say explicitly
whether existing fields could carry it, since the schema resists speculative
deepening (see `docs/TODO.md` on IBIS Arguments for the reasoning).

**Vocabulary proposal** — a term for a domain pack.
The highest-risk kind, because it is inherently about domain content. Rules:
propose it as a `facet:term` with `alt:` labels; justify it from the *domain*,
not from a client; never quote a real sentence as evidence. If a term only makes
sense given one client's setup, it is not spine material — it belongs as a
free-form topic in that brain, and `tools/spine.ts candidates` exists to promote
recurring ones on evidence later.

**Not an issue for this repo:** anything about one deployment's configuration,
"our client wants X", brains that need fixing, or private repo commit SHAs.

## Pull requests

Same rule, plus the repo's own standards:

- `npx vitest run` green, including both leakage lints.
- New behaviour comes with a test that fails without the change. Tests here are
  expected to be non-vacuous — see `tools/session.test.ts`, which reproduces the
  corruption it prevents before proving the fix.
- Schema changes update `schema/SCHEMA.md` (normative) and, if they add a
  finding type, both `schema/FINDINGS.md` and the `TYPES` list in
  `tools/commit-finding.sh` — a test asserts those agree in both directions,
  because they once silently disagreed and the gate rejected every observation
  commit.
- Keep the capability layer domain-agnostic. Vocabulary goes in `domains/`.

## If in doubt

File the issue with the mechanism described and the specifics left out, and say
you have left them out. A maintainer can ask a narrowing question. Nobody can
unpublish a client's name.
