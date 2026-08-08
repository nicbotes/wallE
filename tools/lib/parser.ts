/**
 * The one parser for client brains. Both the validator and the eval graders
 * use this — one implementation, no drift.
 *
 * Entity encoding (schema/SCHEMA.md): a `## Display Name (id)` heading followed
 * by one fenced ```yaml block, then prose. Drops use file-level frontmatter.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  Brain,
  ClientProfile,
  Decision,
  Drop,
  EntityBlock,
  Incentive,
  LogEntry,
  Observation,
  Project,
  ProjectCharter,
  Requirement,
  ScopeItem,
  Stakeholder,
  Tension,
} from "./types.js";

const HEADING_RE = /^## (.+?)\s*\(([a-z0-9-]+)\)\s*$/;
const LOG_HEADING_RE = /^## (\d{4}-\d{2}-\d{2})\s+(.+)$/;
const SECTION_RE = /^## (In|Out|Undecided)\s*$/;

function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, "");
}

/** Extract the first fenced yaml block from a chunk of markdown. */
function firstYamlBlock(chunk: string): { yaml: string; rest: string } | null {
  const m = chunk.match(/```yaml\n([\s\S]*?)\n```/);
  if (!m) return null;
  const rest = chunk.slice((m.index ?? 0) + m[0].length);
  return { yaml: m[1] ?? "", rest };
}

/**
 * Parse `## Name (id)` entity blocks out of a markdown file.
 * Scope files interleave `## In/Out/Undecided` section headings; the current
 * section is attached to each block.
 */
export function parseEntityBlocks(md: string, file: string, errors: string[]): EntityBlock[] {
  const text = stripComments(md);
  const lines = text.split("\n");
  const blocks: EntityBlock[] = [];
  let section: string | undefined;

  // Collect heading line indexes first, then slice chunks between them.
  const marks: { line: number; kind: "entity" | "section"; m: RegExpMatchArray }[] = [];
  lines.forEach((line, i) => {
    const sec = line.match(SECTION_RE);
    if (sec) {
      marks.push({ line: i, kind: "section", m: sec });
      return;
    }
    const ent = line.match(HEADING_RE);
    if (ent) marks.push({ line: i, kind: "entity", m: ent });
  });

  marks.forEach((mark, idx) => {
    if (mark.kind === "section") {
      section = (mark.m[1] ?? "").toLowerCase();
      return;
    }
    const next = marks[idx + 1];
    const chunk = lines.slice(mark.line + 1, next ? next.line : lines.length).join("\n");
    const displayName = mark.m[1] ?? "";
    const id = mark.m[2] ?? "";
    const y = firstYamlBlock(chunk);
    if (!y) {
      errors.push(`${file}: entity "${displayName}" (${id}) has no yaml block`);
      return;
    }
    let fields: Record<string, unknown>;
    try {
      fields = (parseYaml(y.yaml) ?? {}) as Record<string, unknown>;
    } catch (e) {
      errors.push(`${file}: entity "${displayName}" (${id}) has invalid yaml: ${e}`);
      return;
    }
    if (fields["id"] !== undefined && fields["id"] !== id) {
      errors.push(`${file}: heading id "${id}" != yaml id "${fields["id"]}"`);
    }
    blocks.push({ displayName, id, fields, prose: y.rest.trim(), file, section });
  });

  return blocks;
}

/** Parse a single-entity file (client.md, project.md): `# Title` + yaml block. */
function parseSingleEntity(md: string, file: string, errors: string[]): Record<string, unknown> | null {
  const y = firstYamlBlock(stripComments(md));
  if (!y) {
    errors.push(`${file}: no yaml block found`);
    return null;
  }
  try {
    return (parseYaml(y.yaml) ?? {}) as Record<string, unknown>;
  } catch (e) {
    errors.push(`${file}: invalid yaml: ${e}`);
    return null;
  }
}

/** Parse a drop file: frontmatter + verbatim body. */
function parseDrop(fullPath: string, relPath: string, errors: string[]): Drop | null {
  const raw = readFileSync(fullPath, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) {
    errors.push(`${relPath}: drop has no frontmatter`);
    return null;
  }
  try {
    const fm = (parseYaml(m[1] ?? "") ?? {}) as Record<string, unknown>;
    return { ...(fm as unknown as Drop), path: relPath };
  } catch (e) {
    errors.push(`${relPath}: invalid frontmatter: ${e}`);
    return null;
  }
}

/** Parse log.md: `## YYYY-MM-DD Title` headings + yaml blocks. */
function parseLog(md: string, file: string, errors: string[]): LogEntry[] {
  const text = stripComments(md);
  const lines = text.split("\n");
  const entries: LogEntry[] = [];
  const marks: { line: number; date: string; title: string }[] = [];
  lines.forEach((line, i) => {
    const m = line.match(LOG_HEADING_RE);
    if (m) marks.push({ line: i, date: m[1] ?? "", title: m[2] ?? "" });
  });
  marks.forEach((mark, idx) => {
    const next = marks[idx + 1];
    const chunk = lines.slice(mark.line + 1, next ? next.line : lines.length).join("\n");
    const y = firstYamlBlock(chunk);
    if (!y) {
      errors.push(`${file}: log entry "${mark.title}" has no yaml block`);
      return;
    }
    try {
      const fields = (parseYaml(y.yaml) ?? {}) as Record<string, unknown>;
      entries.push({ ...(fields as unknown as LogEntry), title: mark.title });
    } catch (e) {
      errors.push(`${file}: log entry "${mark.title}" invalid yaml: ${e}`);
    }
  });
  return entries;
}

function readIfExists(p: string): string | null {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

function blocksFrom(root: string, rel: string, errors: string[]): EntityBlock[] {
  const md = readIfExists(path.join(root, rel));
  if (md === null) return [];
  return parseEntityBlocks(md, rel, errors);
}

function asEntities<T>(blocks: EntityBlock[]): T[] {
  return blocks.map((b) => ({ ...b.fields, id: b.id }) as T);
}

/** Parse a full client brain from `clientsDir/slug`. */
export function parseBrain(clientsDir: string, slug: string): Brain {
  const root = path.join(clientsDir, slug);
  const errors: string[] = [];

  const profileMd = readIfExists(path.join(root, "client.md"));
  const profile = profileMd
    ? (parseSingleEntity(profileMd, "client.md", errors) as ClientProfile | null)
    : null;
  if (!profileMd) errors.push("client.md: missing");

  const stakeholders = asEntities<Stakeholder>(blocksFrom(root, "stakeholders.md", errors));
  const incentives = asEntities<Incentive>(blocksFrom(root, "incentives.md", errors));
  const observations = asEntities<Observation>(blocksFrom(root, "observations.md", errors));
  const tensions = asEntities<Tension>(blocksFrom(root, "tensions.md", errors));
  const decisions = asEntities<Decision>(blocksFrom(root, "decisions.md", errors));

  const drops: Drop[] = [];
  const dropsDir = path.join(root, "drops");
  if (existsSync(dropsDir)) {
    for (const name of readdirSync(dropsDir).sort()) {
      if (!name.endsWith(".md")) continue;
      const d = parseDrop(path.join(dropsDir, name), `drops/${name}`, errors);
      if (d) drops.push(d);
    }
  }

  const projects: Project[] = [];
  const projectsDir = path.join(root, "projects");
  if (existsSync(projectsDir)) {
    for (const name of readdirSync(projectsDir).sort()) {
      if (name === "_template") continue;
      const pdir = path.join(projectsDir, name);
      if (!statSync(pdir).isDirectory()) continue;
      const charterMd = readIfExists(path.join(pdir, "project.md"));
      const charter = charterMd
        ? (parseSingleEntity(charterMd, `projects/${name}/project.md`, errors) as ProjectCharter | null)
        : null;
      const scopeBlocks = blocksFrom(root, `projects/${name}/scope.md`, errors);
      const scope: ScopeItem[] = scopeBlocks.map(
        (b) =>
          ({
            ...b.fields,
            id: b.id,
            section: (b.section ?? "") as ScopeItem["section"],
          }) as ScopeItem,
      );
      const requirements = asEntities<Requirement>(
        blocksFrom(root, `projects/${name}/requirements.md`, errors),
      );
      const projDecisions = asEntities<Decision>(
        blocksFrom(root, `projects/${name}/decisions.md`, errors),
      );
      const logMd = readIfExists(path.join(pdir, "log.md"));
      const log = logMd ? parseLog(logMd, `projects/${name}/log.md`, errors) : [];
      projects.push({ slug: name, charter, scope, requirements, decisions: projDecisions, log });
    }
  }

  return {
    slug,
    root,
    profile,
    stakeholders,
    incentives,
    observations,
    tensions,
    decisions,
    drops,
    projects,
    parseErrors: errors,
  };
}

/** All entity blocks (with prose) across a brain — used by graders/judge. */
export function parseAllBlocks(clientsDir: string, slug: string): EntityBlock[] {
  const root = path.join(clientsDir, slug);
  const errors: string[] = [];
  const rels = [
    "stakeholders.md",
    "incentives.md",
    "observations.md",
    "tensions.md",
    "decisions.md",
  ];
  const projectsDir = path.join(root, "projects");
  if (existsSync(projectsDir)) {
    for (const name of readdirSync(projectsDir).sort()) {
      if (name === "_template") continue;
      if (!statSync(path.join(projectsDir, name)).isDirectory()) continue;
      rels.push(
        `projects/${name}/scope.md`,
        `projects/${name}/requirements.md`,
        `projects/${name}/decisions.md`,
      );
    }
  }
  return rels.flatMap((rel) => blocksFrom(root, rel, errors));
}
