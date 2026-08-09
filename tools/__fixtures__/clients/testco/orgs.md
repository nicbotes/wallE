# Organisations

<!-- A three-tier chain: a parent group above the counterparty we contract
     with, two rival channel partners below it, and our own delivery team.
     Exercises audience scoping, sibling isolation and chain walking. -->

## Crestline Group (org-crestline-group)

```yaml
id: org-crestline-group
name: Crestline Group
tier: upstream
role: Parent group
parent: null
status: active
first_seen: drop-2024-01-05-kickoff
last_confirmed: 2024-03-01
sources: [drop-2024-01-05-kickoff]
```

Holds the licence and sets the rules everything below has to work within.

## TestCo (org-testco)

```yaml
id: org-testco
name: TestCo
tier: principal
role: Operating company
parent: org-crestline-group
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
role: Channel partner
parent: org-testco
status: active
first_seen: drop-2024-02-10-scope-review
last_confirmed: 2024-02-10
sources: [drop-2024-02-10-scope-review]
```

Sells to its own customers under its own name, on TestCo's product.

## Harbour Row (org-harbour-row)

```yaml
id: org-harbour-row
name: Harbour Row
tier: downstream
role: Channel partner
parent: org-testco
status: active
first_seen: drop-2024-02-10-scope-review
last_confirmed: 2024-02-10
sources: [drop-2024-02-10-scope-review]
```

The rival channel partner. Nothing of theirs may reach Brightline, and vice
versa — that separation is what the audience tests assert.

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
