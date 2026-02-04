import { describe, expect, it } from "vitest";
import type { Verdict } from "../types";
import { assertVerdictInvariant } from "./verdict";

describe("assertVerdictInvariant", () => {
  it("throws when the primary issue has perfect stars", () => {
    const verdict: Verdict = {
      overall: {
        grade: "A",
        labelKey: "overall.label.excellent",
        summaryKey: "overall.summary.excellent"
      },
      dimensions: {
        level: { stars: 5, labelKey: "category.level", descriptionKey: "level.excellent" },
        noise: { stars: 5, labelKey: "category.noise", descriptionKey: "noise.very_clean" },
        echo: { stars: 5, labelKey: "category.echo", descriptionKey: "echo.minimal" }
      },
      primaryIssue: "echo",
      copyKeys: {
        explanationKey: "echo.minimal",
        fixKey: "fix.keep_setup",
        impactKey: "impact.echo",
        impactSummaryKey: "impact.no_major_issues"
      }
    };

    expect(() => assertVerdictInvariant(verdict)).toThrow(
      "Verdict primary issue must have fewer than 5 stars."
    );
  });
});
