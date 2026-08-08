/**
 * Regression gate: asserts metric floors against the most recent eval run
 * (eval/.runs/latest.json, produced by `npm run eval`). Skips cleanly when no
 * run exists — the eval needs an API key; this test does not.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LATEST = path.join(REPO, "eval", ".runs", "latest.json");

const FLOORS = {
  recall: 0.9,
  precision: 0.95,
  compliance: 1.0,
  attribution: 0.9,
  supersession: 1.0,
};

describe.skipIf(!existsSync(LATEST))("ingest scores (latest run)", () => {
  const report = existsSync(LATEST)
    ? (JSON.parse(readFileSync(LATEST, "utf8")) as {
        aggregate: Record<string, number | null>;
        drops: string;
      })
    : null;

  it(`fact recall ≥ ${FLOORS.recall}`, () => {
    expect(report!.aggregate["recall"]).toBeGreaterThanOrEqual(FLOORS.recall);
  });

  it(`precision ≥ ${FLOORS.precision}`, () => {
    expect(report!.aggregate["precision"]).toBeGreaterThanOrEqual(FLOORS.precision);
  });

  it(`commit compliance = ${FLOORS.compliance}`, () => {
    expect(report!.aggregate["compliance"]).toBeGreaterThanOrEqual(FLOORS.compliance);
  });

  it(`attribution ≥ ${FLOORS.attribution} (when graded)`, () => {
    const v = report!.aggregate["attribution"];
    if (v !== null) expect(v).toBeGreaterThanOrEqual(FLOORS.attribution);
  });

  it(`supersession = ${FLOORS.supersession} (when graded)`, () => {
    const v = report!.aggregate["supersession"];
    if (v !== null) expect(v).toBeGreaterThanOrEqual(FLOORS.supersession);
  });
});
