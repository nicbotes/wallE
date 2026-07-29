# EVE 🤍

A general-purpose chat agent with a **file-first soul**.

EVE's personality isn't buried in code — it lives in editable Markdown files,
following the [OpenClaw](https://github.com/will-assistant/openclaw-agents)
identity architecture that separates **soul** (philosophy), **identity**
(presentation), and **capabilities** (config). Change who EVE is by editing
files, not TypeScript.

She's a small Next.js app that streams responses from the Anthropic API (Claude)
and deploys to Vercel unchanged.

## The soul

```
soul/
  SOUL.md          values, ethics, personality, vibe   — who EVE chooses to be
  IDENTITY.md      name, voice, presentation            — how EVE shows up
  memory/          durable context across sessions      — what EVE carries forward
AGENTS.md          capabilities & wiring                — what EVE can do
```

At request time, `lib/soul.ts` reads these files and composes them into the
system prompt (IDENTITY → SOUL → memory). Want a different agent? Rewrite
`IDENTITY.md` and `SOUL.md` and redeploy — no code change.

## Run it locally

Prerequisites: Node.js 18.18+ and an [Anthropic API key](https://console.anthropic.com/settings/keys).

```bash
npm install
cp .env.example .env.local        # then paste your ANTHROPIC_API_KEY
npm run dev                        # http://localhost:3000
```

## Deploy to Vercel

1. Push this branch to GitHub.
2. In Vercel, **New Project → import the repo** (framework auto-detects as Next.js).
3. Add an environment variable **`ANTHROPIC_API_KEY`** (and optionally `EVE_MODEL`).
4. Deploy.

The soul files are part of the repo, so they ship with the build and are read at
runtime — no extra configuration needed.

## Configuration

| Env var             | Required | Purpose                                          |
| ------------------- | -------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY` | yes      | Authenticates the Anthropic API.                 |
| `EVE_MODEL`         | no       | Model ID override. Defaults to `claude-opus-5`.  |

## How it fits together

```
Browser (app/page.tsx)
   │  POST /api/chat  { messages }
   ▼
Route handler (app/api/chat/route.ts)   ── Node.js runtime
   │  system = loadSoul()               ── reads soul/ from disk
   ▼
Anthropic Messages API (streaming)
   │  text deltas
   ▼
streamed back to the browser, token by token
```

## Roadmap

This is a working scaffold. Natural next steps:

- **Tools.** Give EVE the ability to act (web search, code, integrations) via the
  Anthropic SDK's tool runner.
- **Writing memory back.** Currently memory is read-only at startup; let EVE
  record learnings between sessions, with human review.
- **Persistence.** Conversations are in-browser only — add a store if you want
  them to survive a refresh.

See `AGENTS.md` for the capability/config details.
