/**
 * Isolated working sessions, so several people (or agents) can write to brains
 * at the same time without corrupting each other's findings.
 *
 *   npx tsx tools/session.ts open <client-slug> [--label <l>] [--base <ref>] [--json]
 *   npx tsx tools/session.ts list [--json]
 *   npx tsx tools/session.ts close <session-id> [--push]
 *   npx tsx tools/session.ts abort <session-id> [--force]
 *
 * WHY THIS EXISTS. `tools/commit-finding.sh` refuses to run when anything is
 * already staged:
 *
 *     if ! git diff --cached --quiet; then fail "index is not clean"; fi
 *
 * That check is repo-global. Two sessions working on *different* clients still
 * collide in one checkout — the second one's gate sees the first one's staged
 * files. Worse, on unlucky timing its `git add` sweeps them into its own
 * commit, and a finding lands in the ledger attributed to the wrong client.
 * That is a correctness bug in the audit trail, which is the one thing the
 * whole design exists to protect.
 *
 * A git worktree fixes it at the root: each worktree has **its own index file**
 * while sharing one object store and one set of refs. So the gate becomes
 * session-local and needs no change at all.
 *
 * MERGE, NEVER REBASE. `schema/FINDINGS.md` forbids rewriting brain history,
 * and a rebase rewrites every commit it moves. Integration is therefore a
 * `--no-ff` merge. That is safe for readers: `readFindingCommits` runs plain
 * `git log` with no `--first-parent`, so findings from every merged session are
 * walked, and the merge commit itself carries no `Finding:` trailer, so
 * `query-log.ts` ignores it.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

function usage(): never {
  console.error(
    [
      "usage:",
      "  npx tsx tools/session.ts open <client-slug> [--label <l>] [--base <ref>] [--json]",
      "  npx tsx tools/session.ts list [--json]",
      "  npx tsx tools/session.ts close <session-id> [--push]",
      "  npx tsx tools/session.ts abort <session-id> [--force]",
    ].join("\n"),
  );
  process.exit(2);
}

const fail = (msg: string): never => {
  console.error(`session: ${msg}`);
  process.exit(1);
};

function git(cwd: string, ...a: string[]): string {
  return execFileSync("git", a, { cwd, encoding: "utf8" }).trim();
}

/**
 * The main checkout, even when we are called from inside a session worktree.
 * `--git-common-dir` is the shared `.git` in both cases; its parent is the
 * repository everything hangs off.
 */
function mainRoot(from: string): string {
  let common: string;
  try {
    common = git(from, "rev-parse", "--git-common-dir");
  } catch {
    return fail(`not a git repository: ${from}`);
  }
  return path.dirname(path.resolve(from, common));
}

const ROOT = mainRoot(process.cwd());
const SESSIONS = path.resolve(opt("root") ?? path.join(ROOT, ".sessions"));
const BRANCH_PREFIX = "session/";

interface Worktree {
  dir: string;
  branch?: string;
  head: string;
}

function worktrees(): Worktree[] {
  const out = git(ROOT, "worktree", "list", "--porcelain");
  const list: Worktree[] = [];
  let cur: Partial<Worktree> = {};
  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (cur.dir) list.push(cur as Worktree);
      cur = { dir: line.slice("worktree ".length) };
    } else if (line.startsWith("HEAD ")) {
      cur.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      cur.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    }
  }
  if (cur.dir) list.push(cur as Worktree);
  return list;
}

interface Session {
  id: string;
  client: string;
  branch: string;
  dir: string;
}

const sessionOf = (w: Worktree): Session | null => {
  if (!w.branch?.startsWith(BRANCH_PREFIX)) return null;
  const id = w.branch.slice(BRANCH_PREFIX.length);
  return { id, client: id.split("--")[0] ?? id, branch: w.branch, dir: w.dir };
};

const sessions = (): Session[] =>
  worktrees().map(sessionOf).filter((s): s is Session => s !== null);

/**
 * Two different questions, so two different checks.
 *
 * In a SESSION, an untracked file is usually a drop someone wrote and has not
 * committed yet — losing it would lose raw material, so it counts as dirty.
 *
 * In the BASE checkout we only care whether a merge can proceed, and untracked
 * files do not block one (git refuses by itself in the rare case they would be
 * overwritten, which the merge is wrapped to catch). Counting them would be
 * worse than pedantic: the `.sessions/` worktrees live inside the repo, so
 * every open session would make the base look permanently dirty.
 */
const hasUncommittedWork = (dir: string): boolean => git(dir, "status", "--porcelain") !== "";
const blocksMerge = (dir: string): boolean =>
  git(dir, "status", "--porcelain", "--untracked-files=no") !== "";

const aheadOf = (base: string, branch: string): number =>
  Number(git(ROOT, "rev-list", "--count", `${base}..${branch}`));

/** Where `base` is checked out, if anywhere — merges must happen there. */
const checkoutOf = (base: string): Worktree | undefined =>
  worktrees().find((w) => w.branch === base);

function currentBranch(): string {
  const b = git(ROOT, "rev-parse", "--abbrev-ref", "HEAD");
  if (b === "HEAD") fail("main checkout is in detached HEAD; pass --base <branch>");
  return b;
}

// --- open --------------------------------------------------------------------

if (cmd === "open") {
  const slug = args[1];
  if (!slug || slug.startsWith("--")) usage();
  const base = opt("base") ?? currentBranch();
  const label = opt("label");

  // A brand-new client is legitimate (brain-init runs inside a session), so a
  // missing directory is a warning, not a refusal — but a typo here would
  // silently create a second brain, so it is worth saying out loud.
  if (!existsSync(path.join(ROOT, "clients", slug)))
    console.error(`session: note — clients/${slug} does not exist yet (new brain?)`);

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  // `--` separates client from the rest, so `client` is recoverable from the id
  // even when the slug itself contains hyphens.
  let id = `${slug}--${stamp}${label ? `-${label}` : ""}`;
  let n = 2;
  while (existsSync(path.join(SESSIONS, id))) id = `${slug}--${stamp}-${n++}`;

  const dir = path.join(SESSIONS, id);
  mkdirSync(SESSIONS, { recursive: true });
  git(ROOT, "worktree", "add", "-b", `${BRANCH_PREFIX}${id}`, dir, base);

  // node_modules is gitignored, so a fresh worktree has none and `npx tsx`
  // would refetch. Same symlink trick as eval/src/sandbox.ts.
  const nm = path.join(ROOT, "node_modules");
  if (existsSync(nm) && !existsSync(path.join(dir, "node_modules")))
    symlinkSync(nm, path.join(dir, "node_modules"));

  if (has("json")) {
    console.log(JSON.stringify({ id, client: slug, branch: `${BRANCH_PREFIX}${id}`, dir, base }, null, 2));
  } else {
    console.log(
      [
        `session ${id} open`,
        `  dir    ${dir}`,
        `  branch ${BRANCH_PREFIX}${id} (from ${base})`,
        "",
        "Run the agent with that directory as its working directory.",
        `When done: npx tsx tools/session.ts close ${id}`,
      ].join("\n"),
    );
  }
  process.exit(0);
}

// --- list --------------------------------------------------------------------

if (cmd === "list") {
  const base = opt("base") ?? currentBranch();
  const rows = sessions().map((s) => ({
    ...s,
    findings: aheadOf(base, s.branch),
    dirty: hasUncommittedWork(s.dir),
  }));
  if (has("json")) {
    console.log(JSON.stringify(rows, null, 2));
  } else if (!rows.length) {
    console.log("no open sessions");
  } else {
    for (const r of rows)
      console.log(
        `${r.id}  client=${r.client}  findings=${r.findings}` +
          `${r.dirty ? "  UNCOMMITTED WORK" : ""}\n  ${r.dir}`,
      );
  }
  process.exit(0);
}

// --- close / abort -----------------------------------------------------------

const id = args[1];
if ((cmd !== "close" && cmd !== "abort") || !id || id.startsWith("--")) usage();

const session = sessions().find((s) => s.id === id);
if (!session) fail(`no open session "${id}" (npx tsx tools/session.ts list)`);
const s = session!;
const base = opt("base") ?? currentBranch();
const ahead = aheadOf(base, s.branch);

function discard(): void {
  git(ROOT, "worktree", "remove", "--force", s.dir);
  git(ROOT, "branch", "-D", s.branch);
}

if (cmd === "abort") {
  if (ahead > 0 && !has("force"))
    fail(
      `session ${id} has ${ahead} committed finding(s) that would be destroyed.\n` +
        `  Integrate them:  npx tsx tools/session.ts close ${id}\n` +
        `  Or discard them: npx tsx tools/session.ts abort ${id} --force`,
    );
  discard();
  console.log(`session ${id} aborted${ahead ? ` (${ahead} finding(s) discarded)` : ""}`);
  process.exit(0);
}

// close
if (hasUncommittedWork(s.dir))
  fail(
    `session ${id} has uncommitted changes — closing would discard them.\n` +
      `  Every change belongs in a finding commit: see schema/FINDINGS.md.\n` +
      `  Inspect: git -C ${s.dir} status`,
  );

if (ahead === 0) {
  discard();
  console.log(`session ${id} closed — no findings recorded`);
  process.exit(0);
}

const into = checkoutOf(base);
if (!into)
  fail(
    `"${base}" is not checked out in any worktree, so there is nowhere to merge.\n` +
      `  The session's work is safe on ${s.branch}. Check out ${base} and run:\n` +
      `    git merge --no-ff ${s.branch}`,
  );
if (blocksMerge(into!.dir))
  fail(
    `the ${base} checkout at ${into!.dir} has uncommitted changes to tracked files.\n` +
      `  Commit or stash them, then retry. Nothing has been changed.`,
  );

// --no-ff so the session stays visible as a unit in history, and so no
// finding commit is ever rewritten (schema/FINDINGS.md forbids that).
try {
  git(into!.dir, "merge", "--no-ff", "--no-edit", "-m", `merge session ${id}`, s.branch);
} catch (e) {
  fail(
    `merge of ${s.branch} into ${base} failed — resolve it by hand.\n` +
      `  The session's work is intact on ${s.branch} and the worktree is untouched.\n` +
      `  ${(e as Error).message.split("\n")[0]}`,
  );
}

discard();
console.log(`session ${id} closed — ${ahead} finding(s) merged into ${base}`);

if (has("push")) {
  git(into!.dir, "push", "origin", base);
  console.log(`pushed ${base} to origin`);
} else {
  console.log(`push when ready: git -C ${into!.dir} push origin ${base}`);
}
