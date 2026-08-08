import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tools/**/*.test.ts"],
          passWithNoTests: true,
          // Several tests shell out to the CLIs (tsx startup ≈ 1s each).
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "corpus",
          include: [
            "eval/tests/corpus-integrity.test.ts",
            "eval/tests/harness-selftest.test.ts",
          ],
          testTimeout: 120_000,
        },
      },
      {
        test: {
          name: "scores",
          include: ["eval/tests/ingest-scores.test.ts"],
          testTimeout: 60_000,
        },
      },
    ],
  },
});
