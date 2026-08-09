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

4. **Attach a domain spine** — the vocabulary a consultant learns before
   meeting anyone. `npx tsx tools/spine.ts validate` lists installed packs;
   set `domains: [<pack>]` in `client.md` for whichever matches this client's
   industry. If none fits, use `domains: [_base]` (engagement concerns only)
   and mention that a pack for their industry can be built later with
   `brain-domain`. Don't invent a pack mid-init — attaching is one line;
   authoring vocabulary deserves its own pass.

5. **Ask whether the engagement spans a chain.** Most don't — one client, one
   organisation, and `orgs.md` stays as shipped. But enterprise work often
   runs through several companies — someone above setting the rules, someone
   below owning the end customer — and getting that down early is much cheaper
   than reconstructing it later. If the user
   describes such a chain, record each organisation in `orgs.md` and commit
   them as `org-new` findings **before** the init commit's people, since
   stakeholders reference them. The brain is named for, and scoped to, **the
   organisation we contract with** (`tier: principal`) — never split a chain
   into separate brains.

6. **Commit** through the gate (one commit for the whole init):
   ```
   tools/commit-finding.sh -c <slug> -t brain-init -e <slug> -s manual \
       -m "initialise client brain" clients/<slug>
   ```

7. **Tell the user** the brain exists with capability but no context yet, and
   that understanding grows drop by drop — invite the first context drop
   (a transcript, notes, an email, or just talking through a meeting).

## Rules

- Slugs are immutable once created; renaming a client later is a `correction`,
  never a directory rename.
- If the user's message that triggered init *also* contains substantive context
  (names, projects, requirements), run `brain-ingest` immediately after — the
  message itself is the first drop (`type: note`).
