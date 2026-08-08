# Domain packs — the thin spine

A **domain pack** is the vocabulary a consultant would learn *before* meeting a
client: the handful of dimensions that matter in this industry and the words
practitioners actually use for them. It is capability, not content — packs ship
with the repo, brains attach them.

The design is deliberately hybrid, because both pure approaches fail:

- A **rigid taxonomy** rots. The domain shifts, the tree doesn't, and everything
  ends up tagged "other".
- **Pure free tagging** yields forty near-synonyms ("cover", "coverage",
  "benefit") and no comparability across clients — which is where the leverage
  is ("every client who hit this during migration").

So: a **thin controlled spine at the top, free-form topics underneath, and an
explicit promotion path between them.**

## Facets, not a tree

A spine is a small set of **orthogonal facets** rather than one hierarchy,
because a real discussion has several independent coordinates at once — a
conversation can be about *motor* × *coverage* × *renewal* × *migration*
simultaneously, and a tree forces you to pick one.

```yaml
domain: insurance
extends: _base          # optional; inherits its facets
facets:
  - id: component
    label: Product component
    terms:
      - { id: coverage, label: Coverage, alt: [cover, benefit, benefits] }
```

## Topic strings

Two forms, and the difference is load-bearing:

| Form | Example | Meaning |
| --- | --- | --- |
| `facet:term` | `component:coverage` | **Controlled.** Must resolve against an attached spine — the validator enforces it. Comparable across clients. |
| bare slug | `renewal-pricing-quirk` | **Free-form.** Anything the spine doesn't cover yet. Always allowed; these are the promotion candidates. |

`alt:` labels are how the same idea said three different ways ("cover",
"benefit") resolves to one term — the SKOS `altLabel` idea, kept deliberately
lightweight.

## The promotion path

Free-form topics that keep recurring are evidence the spine is missing
something. `npx tsx tools/spine.ts candidates` reports bare topics by frequency
and how many clients use them. Promoting one into a pack is a normal edit +
commit, done by a human, through the `brain-domain` skill.

That is the whole mechanism: **let vocabulary emerge, then harvest it
deliberately** — rather than designing an ontology up front and hoping it
survives contact with real clients.

## Packs here

- `_base/` — engagement concerns that apply to any consulting work regardless
  of industry. Most packs should `extends: _base`.
- `insurance/` — a **starting point**, not gospel. Expect to edit it as you
  learn what your clients actually say.
- `_template/` — copy this to start a new domain.

## Rules

- Packs are **domain** knowledge, never client knowledge. No client names,
  no project names, nothing learned from a specific engagement.
- Term ids are stable once published; renaming one orphans every topic that
  used it. Add `alt:` labels instead.
- Keep facets few (3–5) and terms coarse. A spine you can hold in your head is
  one people will actually use.
