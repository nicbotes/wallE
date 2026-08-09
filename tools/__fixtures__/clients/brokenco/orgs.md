# Organisations

<!-- Every org-level violation class, one entity each. -->

## Bad Tier Co (org-bad-tier)

```yaml
id: org-bad-tier
name: Bad Tier Co
tier: overlord
role: Unclear
parent: null
status: active
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

Tier is not in the enum.

## Orphan Parent Co (org-orphan-parent)

```yaml
id: org-orphan-parent
name: Orphan Parent Co
tier: downstream
role: Distribution brand
parent: org-does-not-exist
status: active
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

Parent does not resolve.

## Loop A (org-loop-a)

```yaml
id: org-loop-a
name: Loop A
tier: principal
role: Managing agent
parent: org-loop-b
status: active
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

Half of a cyclic parent chain.

## Loop B (org-loop-b)

```yaml
id: org-loop-b
name: Loop B
tier: upstream
role: Capacity provider
parent: org-loop-a
status: active
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

The other half. Walking the chain from either end must terminate rather than
hang.

## First Us (org-first-us)

```yaml
id: org-first-us
name: First Us
tier: us
role: Technology partner
parent: null
status: active
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

One of two organisations claiming to be us.

## Second Us (org-second-us)

```yaml
id: org-second-us
name: Second Us
tier: us
role: Also technology partner
parent: null
status: dissolved
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

The other one, plus a status outside the enum.
