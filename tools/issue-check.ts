/**
 * Check a draft issue before it leaves for the public shell repo.
 *
 *   npx tsx tools/issue-check.ts <draft.md> [--clients-dir <dir>] [--json]
 *   cat draft.md | npx tsx tools/issue-check.ts -
 *
 * Exit 0 = nothing found, 1 = errors found, 2 = usage. Warnings never fail the
 * run; they are things a human should glance at, not things that are wrong.
 *
 * See CONTRIBUTING.md. This is the mechanical half of the rule stated there —
 * it cannot make a report safe, only catch the leaks that are checkable.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { identifiersFromBrains, publicIdentifiers, scanDraft, type Leak } from "./lib/redaction.js";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const flagValues = new Set([opt("clients-dir")].filter(Boolean) as string[]);
const target = args.find((a) => !a.startsWith("--") && !flagValues.has(a));

if (!target) {
  console.error(
    "usage: npx tsx tools/issue-check.ts <draft.md|-> [--clients-dir <dir>] [--json]",
  );
  process.exit(2);
}

const text =
  target === "-"
    ? readFileSync(0, "utf8")
    : existsSync(target)
      ? readFileSync(target, "utf8")
      : (console.error(`no such file: ${target}`), process.exit(2));

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const identifiers = identifiersFromBrains(clientsDir);
// The shipped fixtures are already public, and CONTRIBUTING.md tells you to
// build your repro on them — so they must never be reported as leaks.
const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leaks = scanDraft(text, identifiers, publicIdentifiers(repoDir));

const errors = leaks.filter((l) => l.severity === "error");
const warnings = leaks.filter((l) => l.severity === "warning");

/**
 * How much of the check actually ran. Without brains to compare against, only
 * the vocabulary and shape rules applied — and a bare "0 findings" would read
 * as "safe to send" when almost nothing was verified.
 */
const coverage = identifiers.length
  ? `compared against ${identifiers.length} identifiers from brains in ${clientsDir}`
  : `NO BRAINS FOUND at ${clientsDir} — only vocabulary and shape rules ran. ` +
    `Names, aliases and ids from real brains were NOT checked. Run this where ` +
    `the brains live, or re-read the draft yourself.`;

if (has("json")) {
  console.log(JSON.stringify({ coverage, identifiers: identifiers.length, leaks }, null, 2));
} else {
  const show = (l: Leak) =>
    console.log(
      `${l.severity === "error" ? "LEAK " : "CHECK"} line ${l.line}: ${l.kind} "${l.term}"\n      ${l.text}`,
    );
  errors.forEach(show);
  warnings.forEach(show);
  console.log(`\n${coverage}`);
  if (errors.length)
    console.log(
      `\n${errors.length} leak(s), ${warnings.length} to check. Do not file this as-is —\n` +
        `rebuild the report on the shipped fixtures instead (see CONTRIBUTING.md).`,
    );
  else if (warnings.length)
    console.log(`\nNo leaks. ${warnings.length} thing(s) worth a human glance.`);
  else console.log("\nNothing found.");
}

process.exit(errors.length ? 1 : 0);
