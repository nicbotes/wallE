# Organisations

<!-- A three-tier chain: an upstream provider above the counterparty we
     contract with, two distribution brands below it, and our own delivery
     team. Exercises audience scoping, sibling isolation and chain walking. -->

## Northwind Capacity (org-northwind-capacity)

```yaml
id: org-northwind-capacity
name: Northwind Capacity
tier: upstream
role: Capacity provider
parent: null
status: active
first_seen: drop-2024-01-05-kickoff
last_confirmed: 2024-03-01
sources: [drop-2024-01-05-kickoff]
```

Carries the risk and sets the rules everything below has to work within.

## TestCo (org-testco)

```yaml
id: org-testco
name: TestCo
tier: principal
role: Managing agent
parent: org-northwind-capacity
status: active
first_seen: drop-2024-01-05-kickoff
last_confirmed: 2024-03-01
sources: [drop-2024-01-05-kickoff]
```

Who we contract with, and who this brain is named for.

## Brightline (org-brightline)

```yaml
id: org-brightline
name: Brightline
tier: downstream
role: Distribution brand
parent: org-testco
status: active
first_seen: drop-2024-02-10-scope-review
last_confirmed: 2024-02-10
sources: [drop-2024-02-10-scope-review]
```

Sells under its own name on TestCo's paper.

## Harbour Row (org-harbour-row)

```yaml
id: org-harbour-row
name: Harbour Row
tier: downstream
role: Distribution brand
parent: org-testco
status: active
first_seen: drop-2024-02-10-scope-review
last_confirmed: 2024-02-10
sources: [drop-2024-02-10-scope-review]
```

The sibling brand. Nothing of theirs may reach Brightline, and vice versa —
that separation is what the audience tests assert.

## Our delivery team (org-ours)

```yaml
id: org-ours
name: Our delivery team
tier: us
role: Technology partner
parent: null
status: active
first_seen: drop-2024-01-05-kickoff
last_confirmed: 2024-03-01
sources: [drop-2024-01-05-kickoff]
```

Us. Recorded so speaker labels resolve and so client-facing views can exclude
our own people by organisation as well as by `side`.
