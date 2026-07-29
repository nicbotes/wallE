import Anthropic from "@anthropic-ai/sdk";
import { loadSoul } from "@/lib/soul";

// The soul files are read from disk, so this route needs the Node.js runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.EVE_MODEL || "claude-opus-5";
const MAX_TOKENS = 4096;

type IncomingMessage = { role: "user" | "assistant"; content: string };

function isValidMessages(value: unknown): value is IncomingMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
  );
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = (body as { messages?: unknown })?.messages;
  if (!isValidMessages(messages) || messages.length === 0) {
    return Response.json(
      { error: "Body must be { messages: [{ role, content }, ...] }." },
      { status: 400 },
    );
  }

  const system = await loadSoul();
  const client = new Anthropic();

  // Stream tokens straight through to the browser as plain text.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages,
        });

        anthropicStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await anthropicStream.finalMessage();
        controller.close();
      } catch (err) {
        const message =
          err instanceof Anthropic.APIError
            ? `Anthropic API error (${err.status ?? "?"}): ${err.message}`
            : "Something went wrong talking to the model.";
        // If nothing has streamed yet the client shows this; otherwise it's appended.
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
