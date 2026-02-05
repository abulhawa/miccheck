import { describe, expect, it } from "vitest";
import { ANALYSIS_CONFIG } from "../config";
import { buildCategoryScores, buildVerdictDimensionsFromMetrics } from "./categoryScores";

const buildScores = (rmsDb: number, snrDb: number, clippingRatio = 0, humRatio = 0) =>
  buildCategoryScores(
    { rms: 0, rmsDb },
    { clippingRatio, peak: 0 },
    { noiseFloor: 0, snrDb, humRatio, confidence: "low" },
    { echoScore: 0 }
  );

describe("buildCategoryScores", () => {
  it("flags clipping as a critical level issue", () => {
    const scores = buildScores(
      ANALYSIS_CONFIG.targetRmsDb,
      ANALYSIS_CONFIG.snrGoodDb,
      ANALYSIS_CONFIG.clippingRatioWarning + 0.01
    );

    expect(scores.level.stars).toBe(1);
    expect(scores.level.descriptionKey).toBe("level.clipping_detected");
  });

  it("marks extremely quiet input as severe", () => {
    const scores = buildScores(ANALYSIS_CONFIG.minRmsDbSevere - 1, ANALYSIS_CONFIG.snrGoodDb);

    expect(scores.level.stars).toBe(1);
    expect(scores.level.descriptionKey).toBe("level.extremely_quiet");
  });

  it("marks off-target level as acceptable", () => {
    const scores = buildScores(ANALYSIS_CONFIG.targetRmsDb - ANALYSIS_CONFIG.targetRangeDb + 1, ANALYSIS_CONFIG.snrGoodDb);

    expect(scores.level.stars).toBe(4);
    expect(scores.level.descriptionKey).toBe("level.slightly_off_target");
  });

  it("uses the 5-tier SNR grading without hum", () => {
    const scores = buildScores(ANALYSIS_CONFIG.targetRmsDb, ANALYSIS_CONFIG.snrFairDb + 1);

    expect(scores.noise.stars).toBe(3);
    expect(scores.noise.descriptionKey).toBe("noise.some_background_noise");
  });

  it("prioritizes hum detection over SNR tiers", () => {
    const scores = buildScores(
      ANALYSIS_CONFIG.targetRmsDb,
      ANALYSIS_CONFIG.snrExcellentDb,
      0,
      ANALYSIS_CONFIG.humWarningRatio + 0.01
    );

    expect(scores.noise.stars).toBe(2);
    expect(scores.noise.descriptionKey).toBe("noise.electrical_hum");
  });

  it("does not let hum override a worse noise rating", () => {
    const scores = buildScores(
      ANALYSIS_CONFIG.targetRmsDb,
      ANALYSIS_CONFIG.snrPoorDb - 1,
      0,
      ANALYSIS_CONFIG.humWarningRatio + 0.01
    );

    expect(scores.noise.stars).toBe(1);
    expect(scores.noise.descriptionKey).toBe("noise.very_noisy");
  });
});


describe("buildVerdictDimensionsFromMetrics", () => {
  it("matches buildCategoryScores for representative fixtures", () => {
    const fixtures = [
      {
        clippingRatio: ANALYSIS_CONFIG.clippingRatioWarning + 0.01,
        rmsDb: ANALYSIS_CONFIG.targetRmsDb,
        snrDb: ANALYSIS_CONFIG.snrExcellentDb,
        humRatio: 0,
        echoScore: 0
      },
      {
        clippingRatio: 0,
        rmsDb: ANALYSIS_CONFIG.minRmsDbSevere - 0.1,
        snrDb: ANALYSIS_CONFIG.snrPoorDb - 0.1,
        humRatio: ANALYSIS_CONFIG.humWarningRatio + 0.01,
        echoScore: ANALYSIS_CONFIG.echoSevereScore + 0.01
      },
      {
        clippingRatio: 0,
        rmsDb: ANALYSIS_CONFIG.targetRmsDb,
        snrDb: ANALYSIS_CONFIG.snrGoodDb,
        humRatio: 0,
        echoScore: ANALYSIS_CONFIG.echoWarningScore * 0.7
      }
    ];

    fixtures.forEach((fixture) => {
      const fromMetrics = buildVerdictDimensionsFromMetrics(fixture);
      const fromCategoryScores = buildCategoryScores(
        { rms: 0, rmsDb: fixture.rmsDb },
        { clippingRatio: fixture.clippingRatio, peak: 0 },
        { noiseFloor: 0, snrDb: fixture.snrDb, humRatio: fixture.humRatio, confidence: "low" },
        { echoScore: fixture.echoScore }
      );

      expect(fromMetrics).toEqual(fromCategoryScores);
    });
  });
});
