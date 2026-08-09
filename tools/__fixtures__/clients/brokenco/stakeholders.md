# Stakeholders

## Cy Doe (sh-cy-doe)

```yaml
id: sh-cy-doe
name: Cy Doe
role: COO
org: org-vanished
side: theirs
aliases: ["Cy", "CD"]
status: active
disposition: enthusiastic
influence: high
reports_to: sh-nobody-here
projects: [proj-ghost]
first_seen: drop-2024-01-01-missing
last_confirmed: 2024-01-01
sources: [drop-2024-01-01-missing]
```

Bad disposition enum, dangling reports_to, ghost project, missing drop refs.

## No Yaml Person (sh-no-yaml)

Missing the yaml block entirely.

## Alias Thief (sh-alias-thief)

```yaml
id: sh-alias-thief
name: Alias Thief
role: Unknown
org: org-first-us
side: client
aliases: ["Cy", "at@brokenco.example"]
status: active
disposition: unknown
influence: low
reports_to: null
projects: []
first_seen: drop-2024-03-15-workshop
last_confirmed: 2024-03-15
sources: [drop-2024-03-15-workshop]
```

Claims the alias "Cy", which sh-cy-doe already owns.
