# AGENTS.md

> In the OpenClaw architecture the three concerns are deliberately split:
>
> | File            | Concern       | Answers                                  |
> | --------------- | ------------- | ---------------------------------------- |
> | `soul/SOUL.md`  | philosophy    | Who does EVE *choose to be*?             |
> | `soul/IDENTITY.md` | presentation | How does EVE *show up* — name, voice?   |
> | `AGENTS.md`     | capabilities  | What can EVE *do*, and how is she wired? |
>
> This file is the capability/config layer. It's also the conventional place
> agent tooling looks for operating instructions, so it doubles as the
> contributor guide for this repo.

## What EVE is

EVE is a general-purpose conversational agent with a strong, file-defined
identity. She runs as a Next.js app that streams responses from the Anthropic
API (Claude). Her personality is not hardcoded in the prompt — it's assembled at
request time from the `soul/` files.

## Capabilities (this version)

- Multi-turn streaming chat through the Anthropic Messages API.
- Identity assembled from `soul/SOUL.md` + `soul/IDENTITY.md` + `soul/memory/**`.
- Runs locally and deploys to Vercel unchanged.

## Not yet wired (roadmap)

- **Tools.** No tool use yet. The Anthropic SDK's tool runner is the intended
  path when EVE needs to act (search, code, integrations).
- **Writing memory back.** Memory is currently read-only at startup. Writing
  learnings back — with human review — is the next step.
- **Persistence.** Conversations live in the browser session only; there's no
  database.

## How the identity is loaded

`lib/soul.ts` reads the soul files from disk at request time and composes them
into the system prompt, in this order: IDENTITY → SOUL → memory. The chat route
(`app/api/chat/route.ts`) passes that as the `system` parameter on every request.

To change who EVE is, **edit the `soul/` files** — not the TypeScript.

## Model

Defaults to `claude-opus-5`. Override with the `EVE_MODEL` environment variable.

## Configuration

| Env var             | Required | Purpose                                  |
| ------------------- | -------- | ---------------------------------------- |
| `ANTHROPIC_API_KEY` | yes      | Authenticates the Anthropic API.         |
| `EVE_MODEL`         | no       | Model ID override (default `claude-opus-5`). |

## Conventions for contributors

- Keep personality in `soul/`, plumbing in `lib/` and `app/`.
- Match the surrounding code's style; keep the app dependency-light.
- Don't commit secrets. `.env.local` is git-ignored; use `.env.example` as the
  template.
