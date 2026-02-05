import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const filesToCheck = [
  "app/test/page.tsx",
  "app/results/page.tsx",
  "components/ScoreCard.tsx",
  "components/BestNextSteps.tsx",
  "lib/analysis.ts"
];

const forbiddenPatterns = [
  "@miccheck/audio-metrics/src/policy/",
  "thresholdMatrix",
  "/policy/",
  "analysisDisplayThresholds"
];

describe("web policy boundary guardrail", () => {
  it("does not import policy or threshold modules into apps/web", () => {
    for (const relativePath of filesToCheck) {
      const content = readFileSync(join(process.cwd(), relativePath), "utf8");
      for (const pattern of forbiddenPatterns) {
        expect(content.includes(pattern), `${relativePath} should not include ${pattern}`).toBe(false);
      }
    }
  });
});
