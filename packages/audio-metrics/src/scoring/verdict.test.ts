import { describe, expect, it } from "vitest";
import { ANALYSIS_CONFIG } from "../config";
import type { MetricsSummary, Verdict } from "../types";
import { assertVerdictInvariant, getVerdict } from "./verdict";

/**
 * Semantic failure modes covered in this suite:
 * - “Primary issue assigned when its stars are 5” → `assertVerdictInvariant` test
 *   "throws when the primary issue has perfect stars" + assertion
 *   "Verdict primary issue must have fewer than 5 stars."
 * - “Perfect grade with non-null primary issue” → `getVerdict` test
 *   "maps perfect metrics to the excellent overall label and no primary issue"
 *   asserting `primaryIssue` is null.
 * - “Label/star mismatch (Perfect ≠ 5)” → `assertVerdictInvariant` test
 *   "throws when the primary issue has perfect stars" + assertion
 *   "Verdict primary issue must have fewer than 5 stars."
 */
const buildMetrics = (overrides: Partial<MetricsSummary> = {}): MetricsSummary => ({
  clippingRatio: 0,
  rmsDb: ANALYSIS_CONFIG.targetRmsDb,
  speechRmsDb: ANALYSIS_CONFIG.targetRmsDb,
  snrDb: ANALYSIS_CONFIG.snrExcellentDb,
  humRatio: 0,
  echoScore: 0,
  ...overrides
});

describe("assertVerdictInvariant", () => {
  it("throws when the primary issue has perfect stars", () => {
    const perfectVerdict = getVerdict(buildMetrics());
    const verdict: Verdict = {
      ...perfectVerdict,
      primaryIssue: "echo",
      copyKeys: {
        ...perfectVerdict.copyKeys,
        impactKey: "impact.echo"
      }
    };

    expect(() => assertVerdictInvariant(verdict)).toThrow(
      "Verdict primary issue must have fewer than 5 stars."
    );
  });
});

describe("getVerdict", () => {
  it("maps perfect metrics to the excellent overall label and no primary issue", () => {
    const verdict = getVerdict(buildMetrics());

    expect(verdict.overall.grade).toBe("A");
    expect(verdict.overall.labelKey).toBe("overall.label.excellent");
    expect(verdict.overall.summaryKey).toBe("overall.summary.excellent");
    expect(verdict.primaryIssue).toBeNull();
  });

  it("treats RMS thresholds as strict boundaries", () => {
    const severeBoundary = getVerdict(buildMetrics({ rmsDb: ANALYSIS_CONFIG.minRmsDbSevere }));
    const warningBoundary = getVerdict(buildMetrics({ rmsDb: ANALYSIS_CONFIG.minRmsDb }));
    const severeBelow = getVerdict(buildMetrics({ rmsDb: ANALYSIS_CONFIG.minRmsDbSevere - 0.1 }));

    expect(severeBoundary.dimensions.level.stars).toBe(2);
    expect(warningBoundary.dimensions.level.stars).toBe(3);
    expect(severeBelow.dimensions.level.stars).toBe(1);
  });

  it("honors SNR tier boundaries at exact thresholds", () => {
    const excellent = getVerdict(buildMetrics({ snrDb: ANALYSIS_CONFIG.snrExcellentDb }));
    const good = getVerdict(buildMetrics({ snrDb: ANALYSIS_CONFIG.snrExcellentDb - 0.1 }));
    const fair = getVerdict(buildMetrics({ snrDb: ANALYSIS_CONFIG.snrGoodDb }));
    const poor = getVerdict(buildMetrics({ snrDb: ANALYSIS_CONFIG.snrFairDb - 0.1 }));

    expect(excellent.dimensions.noise.stars).toBe(5);
    expect(good.dimensions.noise.stars).toBe(4);
    expect(fair.dimensions.noise.stars).toBe(4);
    expect(poor.dimensions.noise.stars).toBe(2);
  });

  it("only applies the hum override above the warning ratio", () => {
    const noHumPenalty = getVerdict(
      buildMetrics({
        humRatio: ANALYSIS_CONFIG.humWarningRatio,
        snrDb: ANALYSIS_CONFIG.snrExcellentDb
      })
    );
    const humPenalty = getVerdict(
      buildMetrics({
        humRatio: ANALYSIS_CONFIG.humWarningRatio + 0.01,
        snrDb: ANALYSIS_CONFIG.snrExcellentDb
      })
    );

    expect(noHumPenalty.dimensions.noise.stars).toBe(5);
    expect(humPenalty.dimensions.noise.stars).toBe(2);
  });

  it("keeps echo tiers aligned to the configured boundaries", () => {
    const slightBoundary = getVerdict(
      buildMetrics({ echoScore: ANALYSIS_CONFIG.echoWarningScore * 0.4 })
    );
    const moderateBoundary = getVerdict(
      buildMetrics({ echoScore: ANALYSIS_CONFIG.echoWarningScore * 0.7 })
    );
    const strongBoundary = getVerdict(
      buildMetrics({ echoScore: ANALYSIS_CONFIG.echoWarningScore })
    );
    const severeBoundary = getVerdict(
      buildMetrics({ echoScore: ANALYSIS_CONFIG.echoSevereScore })
    );
    const severeAbove = getVerdict(
      buildMetrics({ echoScore: ANALYSIS_CONFIG.echoSevereScore + 0.01 })
    );

    expect(slightBoundary.dimensions.echo.stars).toBe(5);
    expect(moderateBoundary.dimensions.echo.stars).toBe(4);
    expect(strongBoundary.dimensions.echo.stars).toBe(3);
    expect(severeBoundary.dimensions.echo.stars).toBe(2);
    expect(severeAbove.dimensions.echo.stars).toBe(1);
  });
});
