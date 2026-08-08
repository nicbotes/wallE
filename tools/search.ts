/**
 * Ripgrep-backed search over client brains and their drops.
 *
 *   npx tsx tools/search.ts <pattern> [--client <slug>] [--drops-only]
 *                           [--type <drop-type>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
 *                           [--clients-dir <dir>]
 *
 * Date/type filters apply to drop files (they're encoded in filenames and
 * frontmatter); brain files always match on content only.
 * This is the "now" derived layer — lexical, zero infra. See tools/index.ts
 * for the (future) vector layer contract.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);
const pattern = args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1]?.startsWith("--")));

if (!pattern) {
  console.error("usage: npx tsx tools/search.ts <pattern> [--client <slug>] [--drops-only] [--type <t>] [--from d] [--to d]");
  process.exit(2);
}

const clientsDir = path.resolve(opt("clients-dir") ?? "clients");
const client = opt("client");
const dropType = opt("type");
const from = opt("from");
const to = opt("to");

const roots = client
  ? [path.join(clientsDir, client)]
  : existsSync(clientsDir)
    ? readdirSync(clientsDir)
        .filter((n) => !n.startsWith(".") && !n.startsWith("_"))
        .map((n) => path.join(clientsDir, n))
    : [];

/** Filter a drop path by filename date + frontmatter type. */
function dropMatches(p: string): boolean {
  const base = path.basename(p);
  const dateM = base.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (!dateM) return true;
  const d = dateM[1] ?? "";
  if (from && d < from) return false;
  if (to && d > to) return false;
  if (dropType) {
    const head = readFileSync(p, "utf8").slice(0, 500);
    if (!new RegExp(`^type:\\s*${dropType}\\s*$`, "m").test(head)) return false;
  }
  return true;
}

let any = false;
for (const root of roots) {
  if (!existsSync(root)) continue;
  const targets = has("drops-only") ? [path.join(root, "drops")] : [root];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    let out = "";
    try {
      out = execFileSync(
        "rg",
        ["--line-number", "--no-heading", "--color=never", pattern, target],
        { encoding: "utf8" },
      );
    } catch {
      continue; // rg exits 1 on no matches
    }
    for (const line of out.split("\n")) {
      if (!line) continue;
      const file = line.slice(0, line.indexOf(":"));
      const isDrop = file.includes(`${path.sep}drops${path.sep}`);
      if (isDrop && !dropMatches(file)) continue;
      if ((dropType || from || to) && !isDrop) continue; // drop filters imply drop results
      console.log(path.relative(process.cwd(), file) + line.slice(line.indexOf(":")));
      any = true;
    }
  }
}
process.exit(any ? 0 : 1);
