/**
 * Vector index over drops — DESIGNED EXTENSION POINT, deliberately not built.
 *
 * Contract (when a client's drop corpus outgrows lexical search):
 *
 * - Source of truth stays `clients/<slug>/drops/` — the index is a disposable
 *   projection under `.cache/vectors/<slug>/`, git-ignored, rebuildable from
 *   scratch at any time. Deleting `.cache/` must never lose information.
 * - Engine: an embedded, serverless store — sqlite-vec or LanceDB (both ship
 *   prebuilt binaries for macOS + Linux via npm; no compiler toolchain, no
 *   server process). No client-data leaves the machine except embedding calls.
 * - Unit of indexing: a drop chunk (~1k tokens) keyed by
 *   `{drop_id, chunk_no, content_hash}`. Drops are immutable, so sync is
 *   append-only: walk drops/, index any {drop_id, hash} pair not yet present.
 * - Interface to skills:
 *     npx tsx tools/index.ts build  <client-slug>     # (re)build/refresh
 *     npx tsx tools/index.ts query  <client-slug> "<question>" [--k 8]
 *   Query output: JSON [{drop_id, chunk_no, score, excerpt}] — skills then
 *   Read the actual drop for ground truth; the index only locates, never
 *   answers.
 * - Embeddings: provider-pluggable; cache embeddings by content_hash so
 *   rebuilds are cheap.
 *
 * Until this exists, use tools/search.ts (ripgrep) — it covers the 90% case.
 */

console.error(
  "tools/index.ts is a documented extension point, not yet implemented.\n" +
    "Use tools/search.ts (ripgrep) for now. See this file's header for the contract.",
);
process.exit(2);
