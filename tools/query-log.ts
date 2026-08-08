/**
 * Query the finding event stream (git commit trailers) as JSON.
 *
 *   npx tsx tools/query-log.ts [--repo <dir>] [--client <slug>] [--project <id>]
 *                              [--type <finding-type>] [--entity <id>]
 *                              [--source <drop-id>] [--since <YYYY-MM-DD|ref>]
 *                              [--files]
 *
 * Output: JSON array, newest first. `--since` accepts a date (commit date
 * filter) or a git ref (`<ref>..HEAD`). `--entity` also matches Refs, so a
 * decision's supersession shows up when querying the old entity.
 */

import { readFindingCommits } from "./lib/trailers.js";

const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const repo = opt("repo") ?? process.cwd();
const since = opt("since");
const range = since
  ? /^\d{4}-\d{2}-\d{2}$/.test(since)
    ? `--since=${since}`
    : `${since}..HEAD`
  : undefined;

const commits = readFindingCommits(repo, { withFiles: has("files"), range });

const client = opt("client");
const project = opt("project");
const type = opt("type");
const entity = opt("entity");
const source = opt("source");

const out = commits.filter(
  (c) =>
    c.finding !== undefined &&
    (!client || c.client === client) &&
    (!project || c.project === project) &&
    (!type || c.finding === type) &&
    (!entity || c.entity === entity || c.refs.includes(entity)) &&
    (!source || c.source === source),
);

console.log(JSON.stringify(out, null, 2));
