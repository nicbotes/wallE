/** Typed model of a client brain, as parsed from disk. See schema/SCHEMA.md. */

export type Disposition =
  | "champion"
  | "supportive"
  | "neutral"
  | "skeptical"
  | "blocker"
  | "unknown";

export type Influence = "high" | "medium" | "low";
export type Confidence = "high" | "medium" | "low";

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  org_unit?: string;
  status: "active" | "departed";
  disposition: Disposition;
  influence: Influence;
  reports_to?: string | null;
  projects: string[];
  first_seen: string;
  last_confirmed: string;
  sources: string[];
}

export interface Incentive {
  id: string;
  stakeholder: string;
  kind: "stated" | "inferred";
  confidence: Confidence;
  source: string;
  last_confirmed: string;
}

export interface Decision {
  id: string;
  date: string;
  status: "active" | "superseded";
  decided_by: string[];
  supersedes?: string | null;
  superseded_by?: string | null;
  source: string;
}

export interface Requirement {
  id: string;
  stated_by: string; // sh-... | "unattributed"
  date: string;
  status: "active" | "delivered" | "dropped" | "superseded";
  priority: "must" | "should" | "could" | "unknown";
  source: string;
  last_confirmed: string;
}

export interface Tension {
  id: string;
  status: "open" | "resolved";
  between: string[];
  opened: string;
  source: string;
  resolved?: string | null;
  resolved_by?: string | null;
}

export interface ScopeItem {
  id: string;
  state: "in" | "out" | "undecided";
  since: string;
  decided_by?: string[];
  source: string;
  /** Which section heading (## In / ## Out / ## Undecided) the item sits under. */
  section: "in" | "out" | "undecided";
}

export interface LogEntry {
  kind: "update" | "incident" | "milestone";
  date: string;
  source: string;
  involves?: string[];
  title: string;
}

export interface ProjectCharter {
  id: string;
  name: string;
  status: "active" | "paused" | "delivered" | "killed";
  phase: string;
  started?: string | null;
}

export interface ClientProfile {
  id: string;
  name: string;
  schema_version: number;
  first_contact?: string | null;
}

export interface Drop {
  id: string;
  date: string;
  type: "meeting" | "workshop" | "email" | "slack" | "incident" | "update" | "note";
  title: string;
  participants: string[];
  ingested: string;
  /** Repo-relative path of the drop file. */
  path: string;
}

/** A parsed entity block: heading display name, id, yaml fields, prose, file. */
export interface EntityBlock {
  displayName: string;
  id: string;
  fields: Record<string, unknown>;
  prose: string;
  file: string;
  /** For scope items: the ## In/Out/Undecided section the block sits under. */
  section?: string;
}

export interface Project {
  slug: string;
  charter: ProjectCharter | null;
  scope: ScopeItem[];
  requirements: Requirement[];
  decisions: Decision[];
  log: LogEntry[];
}

export interface Brain {
  slug: string;
  root: string;
  profile: ClientProfile | null;
  stakeholders: Stakeholder[];
  incentives: Incentive[];
  tensions: Tension[];
  /** Org-level decisions. */
  decisions: Decision[];
  drops: Drop[];
  projects: Project[];
  /** Parse-level problems (bad yaml, missing id, …) found while reading. */
  parseErrors: string[];
}
