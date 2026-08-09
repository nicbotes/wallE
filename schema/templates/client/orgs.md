# Organisations

<!--
Only needed when the engagement spans more than one company — whoever sets the
rules above the party we contract with, whoever they deliver through below it, a
regulator or co-vendor to one side. A single-organisation client can leave this
file as it is. See "The value chain" in schema/SCHEMA.md.

One entity per organisation:

## Their Name (org-their-name)

```yaml
id: org-their-name
name: Their Name
tier: downstream          # us | principal | upstream | downstream | peer
role: Channel partner     # free text, in the domain's own words
parent: org-...           # or null at the top of a chain
status: active            # active | former
first_seen: drop-...
last_confirmed: YYYY-MM-DD
sources: [drop-...]
```

Prose: what they do in the chain, what they control, how we deal with them.

`tier` is structural and drives behaviour (whose authority a decision carries,
what each audience may be shown); `role` is the domain's own word for the same
thing. Exactly one organisation may be `tier: us`, and `parent` must not cycle.
-->
