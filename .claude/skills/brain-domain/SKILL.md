---
name: brain-domain
description: Attach a domain pack to a client brain, or create/extend/promote the shared vocabulary ("spine") that topics are tagged against. Use when starting a client in a new industry, when someone explains how a domain works, when topics aren't resolving, or when reviewing what free-form topics should become standard terms.
---

# brain-domain

A **domain pack** is what a consultant learns *before* meeting a client: the
few dimensions that matter in this industry and the words practitioners use.
Packs live in `domains/` and are **capability, not client content** — they ship
with the repo and brains attach them.

Read `domains/README.md` first; it defines the format and the hybrid design
(thin controlled spine + free-form topics + promotion path).

## Four modes

### Attach — put a spine behind an existing brain
Most common. `npx tsx tools/spine.ts validate` lists installed packs.

1. Pick the pack(s) that match the client's industry. If none fits, either
   attach `_base` alone (engagement concerns only — always applicable) or
   **bootstrap** a new pack first.
2. Add to `client.md`: `domains: [insurance]`.
3. Validate and commit:
   ```
   npx tsx tools/validate.ts <slug>
   tools/commit-finding.sh -c <slug> -t domain-attach -e <slug> -s manual \
       -m "attach <pack> spine" clients/<slug>/client.md
   ```
   Attaching does **not** retro-tag existing entities. Topics accrue as new
   drops come in; back-tagging wholesale is churn for little gain.

### Bootstrap — create a pack for a new industry
Triggered by "we're starting in <industry>" or someone explaining how their
domain works.

1. `cp -r domains/_template domains/<slug>`.
2. Draft **3–5 orthogonal facets**. The test for orthogonality: if two facets
   are always assigned together they are one facet; if a term forces an
   either/or that isn't real in practice, split it.
3. Terms **coarse, not exhaustive** — the free-form half catches the long tail
   and `candidates` tells you what to add later. Be generous with `alt:`
   synonyms; that is what makes real speech resolve.
4. `extends: _base` unless engagement concerns genuinely don't apply.
5. Check it: `npx tsx tools/spine.ts validate <slug>`, then sanity-test against
   real sentences the client actually used:
   ```
   npx tsx tools/spine.ts resolve <slug> "<a real sentence from a drop>"
   ```
   **Watch for cross-facet synonym collisions** — a word meaning different
   things in two facets produces false positives. Drop the weaker alt.
6. Commit the pack on its own (capability change, not a client finding).

### Extend — add terms to an existing pack
Same as bootstrap steps 3–6, scoped to new terms. Adding a term or an `alt:` is
safe. **Renaming a term id is not** — it orphans every topic that used it; add
an `alt:` instead, or treat the rename as a deliberate migration.

### Promote — turn recurring free-form topics into spine terms
The harvest step that keeps the spine alive.

```
npx tsx tools/spine.ts candidates --min 2
```

Ranks bare topics by frequency and **client spread**. Judgement:

- Recurs across **several clients** → strong candidate; that's shared
  vocabulary the spine is missing.
- Frequent in **one client only** → usually leave it. It may be that client's
  idiosyncrasy, and promoting it pollutes the shared vocabulary.
- Near-duplicates (`billing-run`, `billing-runs`, `the-billing-run`) → promote
  one term and add the others as `alt:` labels.

Promotion is an ordinary pack edit + commit. **Never rewrite historical
entities to use the new term** — old free-form topics stay as they are; the
`alt:` label makes them findable.

## Rules

- Packs contain **domain** knowledge only. No client names, no project names,
  nothing learned from one engagement. A pack is publishable.
- Prefer too few terms over too many. A spine nobody can hold in their head
  gets ignored, and an ignored spine is worse than none.
- The controlled half exists for cross-client comparison. If a term wouldn't
  help you answer "which clients hit this?", it probably belongs in free-form.
