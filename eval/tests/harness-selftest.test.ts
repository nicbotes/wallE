/**
 * Grader self-test — no API key needed. A scripted "perfect agent" replays an
 * ideal ingest of corpus drop 01 (template copy, drop commit, findings one by
 * one through the commit gate), then the real graders must score it perfectly.
 * Negative cases prove the graders actually catch failures: grading against a
 * later golden must lose recall; a hallucinated entity must cost precision;
 * a squashed mega-commit must cost compliance.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAllowlist, loadGolden } from "../src/goldens.js";
import { gradeDeterministic } from "../src/grade/deterministic.js";
import { gradeCommits } from "../src/grade/gitlog.js";
import { createSandbox, removeSandbox } from "../src/sandbox.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CORPUS = path.join(REPO, "eval", "corpus", "meridian-energy");
const SLUG = "meridian-energy";

let sandbox: string;

function gate(args: string[], files: string[]): void {
  execFileSync("bash", [path.join(sandbox, "tools", "commit-finding.sh"), ...args, ...files], {
    cwd: sandbox,
    encoding: "utf8",
    stdio: "pipe",
  });
}

function write(rel: string, content: string): void {
  writeFileSync(path.join(sandbox, rel), content);
}

/** Scripted perfect ingest of drop 01, exactly as brain-ingest specifies. */
function perfectIngestDrop01(): void {
  const drop = "drop-2024-01-10-kickoff";
  const raw = readFileSync(path.join(CORPUS, "drops", "01-kickoff.md"), "utf8");

  // brain-init
  cpSync(path.join(sandbox, "schema", "templates", "client"), path.join(sandbox, "clients", SLUG), {
    recursive: true,
  });
  write(
    `clients/${SLUG}/client.md`,
    `# Meridian Energy\n\n\`\`\`yaml\nid: ${SLUG}\nname: Meridian Energy\nschema_version: 1\nfirst_contact: 2024-01-10\n\`\`\`\n\nUK energy utility; engaged for the billing replatform.\n\n## Reading order\n\n1. \`stakeholders.md\`\n`,
  );
  gate(
    ["-c", SLUG, "-t", "brain-init", "-e", SLUG, "-s", "manual", "-m", "initialise client brain"],
    [`clients/${SLUG}`],
  );

  // drop (verbatim, frontmatter added)
  write(
    `clients/${SLUG}/drops/2024-01-10-kickoff.md`,
    `---\nid: ${drop}\ndate: 2024-01-10\ntype: meeting\ntitle: Billing replatform kickoff\nparticipants: [Priya Sharma, Marcus Webb, Dana Okafor]\ningested: 2026-08-08\n---\n\n${raw}`,
  );
  gate(
    ["-c", SLUG, "-t", "drop", "-e", drop, "-s", drop, "-m", "meeting: billing replatform kickoff"],
    [`clients/${SLUG}/drops/2024-01-10-kickoff.md`],
  );

  // stakeholders, one commit each
  const sh = (id: string, block: string, summary: string) => {
    appendFileSync(path.join(sandbox, `clients/${SLUG}/stakeholders.md`), block);
    gate(["-c", SLUG, "-t", "stakeholder-new", "-e", id, "-s", drop, "-m", summary], [
      `clients/${SLUG}/stakeholders.md`,
    ]);
  };
  sh(
    "sh-priya-sharma",
    `\n## Priya Sharma (sh-priya-sharma)\n\n\`\`\`yaml\nid: sh-priya-sharma\nname: Priya Sharma\nrole: VP Engineering\nstatus: active\ndisposition: champion\ninfluence: high\nreports_to: null\nprojects: [proj-billing-replatform]\nfirst_seen: ${drop}\nlast_confirmed: 2024-01-10\nsources: [${drop}]\n\`\`\`\n\nDrives the replatform; top priority for her year, will clear roadblocks.\n`,
    "Priya Sharma, VP Engineering — programme champion",
  );
  sh(
    "sh-marcus-webb",
    `\n## Marcus Webb (sh-marcus-webb)\n\n\`\`\`yaml\nid: sh-marcus-webb\nname: Marcus Webb\nrole: CFO\nstatus: active\ndisposition: skeptical\ninfluence: high\nreports_to: null\nprojects: [proj-billing-replatform]\nfirst_seen: ${drop}\nlast_confirmed: 2024-01-10\nsources: [${drop}]\n\`\`\`\n\n"Prove me wrong" on replatform costs; supports only while numbers hold.\n`,
    "Marcus Webb, CFO — sceptical, cost is his sole test",
  );
  sh(
    "sh-dana-okafor",
    `\n## Dana Okafor (sh-dana-okafor)\n\n\`\`\`yaml\nid: sh-dana-okafor\nname: Dana Okafor\nrole: Head of Billing Operations\nstatus: active\ndisposition: neutral\ninfluence: medium\nreports_to: sh-priya-sharma\nprojects: [proj-billing-replatform]\nfirst_seen: ${drop}\nlast_confirmed: 2024-01-10\nsources: [${drop}]\n\`\`\`\n\nRuns billing ops (41 staff); wait-and-see, wants consultation on process.\n`,
    "Dana Okafor, Head of Billing Ops — neutral, wants consultation",
  );

  // project-new
  cpSync(
    path.join(sandbox, `clients/${SLUG}/projects/_template`),
    path.join(sandbox, `clients/${SLUG}/projects/billing-replatform`),
    { recursive: true },
  );
  write(
    `clients/${SLUG}/projects/billing-replatform/project.md`,
    `# Billing Replatform\n\n\`\`\`yaml\nid: proj-billing-replatform\nname: Billing Replatform\nstatus: active\nphase: discovery\nstarted: 2024-01-10\n\`\`\`\n\nReplace the 14-year-old in-house Hermes billing system.\n`,
  );
  gate(
    ["-c", SLUG, "-t", "project-new", "-e", "proj-billing-replatform", "-s", drop, "-p",
      "proj-billing-replatform", "-m", "Billing Replatform project kicked off"],
    [`clients/${SLUG}/projects/billing-replatform`],
  );

  // three scope items, one commit each
  const scope = (id: string, title: string, summary: string) => {
    const p = path.join(sandbox, `clients/${SLUG}/projects/billing-replatform/scope.md`);
    const s = readFileSync(p, "utf8").replace(
      "## In\n",
      `## In\n\n## ${title} (${id})\n\n\`\`\`yaml\nid: ${id}\nstate: in\nsince: 2024-01-10\ndecided_by: [sh-priya-sharma]\nsource: ${drop}\n\`\`\`\n`,
    );
    writeFileSync(p, s);
    gate(
      ["-c", SLUG, "-t", "scope-move", "-e", id, "-s", drop, "-p", "proj-billing-replatform",
        "-a", "sh-priya-sharma", "-m", summary],
      [`clients/${SLUG}/projects/billing-replatform/scope.md`],
    );
  };
  scope("scp-billing-engine", "Replace the Hermes billing engine", "billing engine replacement in scope");
  scope("scp-invoice-generation", "Invoice generation and delivery", "invoice generation in scope");
  scope("scp-billing-history-migration", "Customer billing history migration", "history migration in scope");

  // incentive
  write(
    `clients/${SLUG}/incentives.md`,
    `# Incentives\n\n## Total cost control (inc-marcus-webb-cost-control)\n\n\`\`\`yaml\nid: inc-marcus-webb-cost-control\nstakeholder: sh-marcus-webb\nkind: stated\nconfidence: high\nsource: ${drop}\nlast_confirmed: 2024-01-10\n\`\`\`\n\nHis sole test for the programme is total cost; support lasts while numbers hold.\n`,
  );
  gate(
    ["-c", SLUG, "-t", "incentive-new", "-e", "inc-marcus-webb-cost-control", "-s", drop,
      "-a", "sh-marcus-webb", "-m", "Marcus: total cost is his sole test"],
    [`clients/${SLUG}/incentives.md`],
  );
}

beforeAll(() => {
  sandbox = createSandbox(REPO, `selftest-${process.pid}`);
  perfectIngestDrop01();
}, 120_000);

afterAll(() => {
  if (sandbox) removeSandbox(sandbox);
});

describe("grader self-test: a perfect ingest of drop 01", () => {
  it("validator passes", () => {
    const out = execFileSync("npx", ["tsx", "tools/validate.ts", SLUG], {
      cwd: sandbox,
      encoding: "utf8",
    });
    expect(out).toContain("valid ✓");
  });

  it("scores 1.0 on recall, precision, attribution", () => {
    const det = gradeDeterministic(sandbox, SLUG, loadGolden(CORPUS, 1), loadAllowlist(CORPUS), 1);
    const failed = det.assertions.filter((a) => !a.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(det.recall).toBe(1);
    expect(det.precision.hallucinated).toEqual([]);
    expect(det.precision.precision).toBe(1);
    expect(det.attribution ?? 1).toBe(1);
  });

  it("scores 1.0 on commit-protocol compliance", () => {
    const golden = loadGolden(CORPUS, 1);
    const comp = gradeCommits(sandbox, golden.deterministic.commit_protocol!, null, true);
    const failed = comp.checks.filter((c) => !c.pass);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(comp.compliance).toBe(1);
    expect(comp.commits).toBeGreaterThanOrEqual(9);
  });
});

describe("grader self-test: failures are actually caught", () => {
  it("grading against a later golden loses recall", () => {
    const det = gradeDeterministic(sandbox, SLUG, loadGolden(CORPUS, 2), loadAllowlist(CORPUS), 2);
    expect(det.recall).toBeLessThan(1); // drop-02 requirements don't exist yet
  });

  it("a hallucinated stakeholder costs precision", () => {
    appendFileSync(
      path.join(sandbox, `clients/${SLUG}/stakeholders.md`),
      `\n## John Doe (sh-john-doe)\n\n\`\`\`yaml\nid: sh-john-doe\nname: John Doe\nrole: Unknown\nstatus: active\ndisposition: unknown\ninfluence: low\nreports_to: null\nprojects: []\nfirst_seen: drop-2024-01-10-kickoff\nlast_confirmed: 2024-01-10\nsources: [drop-2024-01-10-kickoff]\n\`\`\`\n\nNot in any drop.\n`,
    );
    const det = gradeDeterministic(sandbox, SLUG, loadGolden(CORPUS, 1), loadAllowlist(CORPUS), 1);
    expect(det.precision.hallucinated).toEqual([{ type: "stakeholders", id: "sh-john-doe" }]);
    expect(det.precision.precision).toBeLessThan(1);
  });

  it("an untrailered mega-commit costs compliance", () => {
    writeFileSync(path.join(sandbox, `clients/${SLUG}/tensions.md`), "# Tensions\n\nedited\n");
    writeFileSync(path.join(sandbox, `clients/${SLUG}/decisions.md`), "# Decisions (org-level)\n\nedited\n");
    execFileSync("git", ["add", "-A"], { cwd: sandbox });
    execFileSync("git", ["commit", "-qm", "squashed everything, no trailers"], { cwd: sandbox });
    const golden = loadGolden(CORPUS, 1);
    const comp = gradeCommits(sandbox, golden.deterministic.commit_protocol!, null, true);
    const failed = comp.checks.filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toContain("all-commits-trailered");
    expect(comp.compliance).toBeLessThan(1);
  });
});
