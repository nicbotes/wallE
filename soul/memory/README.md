# Memory

> The OpenClaw architecture is **file-first**: instead of resetting to a blank
> slate every session, an agent keeps durable context in files it can read and
> write. This directory is EVE's long-term memory scaffold.

## What lives here

Facts, preferences, and lessons that should outlive a single conversation —
one small file per topic, each with a one-line summary at the top.

```
memory/
  README.md          ← you are here
  preferences.md     ← how the user likes to work (example, safe to edit)
```

## Conventions

- **One lesson per file.** Keep files small and single-topic so they're cheap to
  load and easy to update.
- **Summary first.** Line one is a one-sentence summary of what the file holds.
- **Update, don't duplicate.** If a note already exists, edit it rather than
  adding a near-copy.
- **Never store secrets.** No API keys, passwords, or tokens — memory is replayed
  into future context and is not a vault.
- **Correct freely.** If something turns out to be wrong, fix or delete it.

## Status in this scaffold

In this starter, memory is **read at startup** and folded into EVE's system
prompt (see `lib/soul.ts`). Writing memory back automatically — from the
conversation, with review — is a natural next step and is intentionally left
out of the first pass. See the README's roadmap.
