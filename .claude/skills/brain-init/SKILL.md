---
name: brain-init
description: Set up a brain for a new client. Use when the user mentions a client that has no directory under clients/, or asks to start tracking a client. Creates the structure from the template — capability, no context.
---

# brain-init

Read `schema/SCHEMA.md` before writing anything. Never invent facts.

## Procedure

1. **Derive the slug**: kebab-case of the client's name (e.g. "Acme Financial"
   → `acme-financial`). If `clients/<slug>/` already exists, stop — this is an
   existing brain; use `brain-ingest` instead.

2. **Copy the template**:
   ```
   cp -r schema/templates/client clients/<slug>
   ```
   Leave `projects/_template/` in place — it is dormant until a real project is
   named (then `brain-ingest` copies it to `projects/<proj-slug>/`).

3. **Fill `client.md`** from whatever context the user has already given:
   replace `CLIENT_NAME`/`CLIENT_SLUG`, set `first_contact` if known (else
   leave `null`), write the org description **only from what you were told** —
   mark unknowns as unknown. Do not touch the other template files; they start
   empty by design.

4. **Commit** through the gate (one commit for the whole init):
   ```
   tools/commit-finding.sh -c <slug> -t brain-init -e <slug> -s manual \
       -m "initialise client brain" clients/<slug>
   ```

5. **Tell the user** the brain exists with capability but no context yet, and
   that understanding grows drop by drop — invite the first context drop
   (a transcript, notes, an email, or just talking through a meeting).

## Rules

- Slugs are immutable once created; renaming a client later is a `correction`,
  never a directory rename.
- If the user's message that triggered init *also* contains substantive context
  (names, projects, requirements), run `brain-ingest` immediately after — the
  message itself is the first drop (`type: note`).
