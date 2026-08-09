# Decisions (org-level)

## Impossible future decision (dec-20250901-time-traveller)

```yaml
id: dec-20250901-time-traveller
date: 2025-09-01
status: active
decided_by: [sh-cy-doe]
authority: org-not-in-the-chain
supersedes: null
superseded_by: null
source: drop-2024-03-15-workshop
```

Dated after the drop that supposedly taught us about it.

## One-way supersede (dec-20240315-one-way)

```yaml
id: dec-20240315-one-way
date: 2024-03-15
status: active
decided_by: [sh-cy-doe]
supersedes: dec-20240301-orphan
superseded_by: null
source: drop-2024-03-15-workshop
```

Supersedes a decision that doesn't point back (and isn't marked superseded).

## Orphan (dec-20240301-orphan)

```yaml
id: dec-20240301-orphan
date: 2024-03-01
status: active
decided_by: []
supersedes: null
superseded_by: null
source: drop-2024-03-15-workshop
```

Should be status superseded with superseded_by dec-20240315-one-way.
