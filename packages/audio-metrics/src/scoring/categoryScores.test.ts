import { describe, expect, it } from "vitest";
import { ANALYSIS_CONFIG } from "../config";
import { buildCategoryScores } from "./categoryScores";

const buildScores = (rmsDb: number, snrDb: number, clippingRatio = 0, humRatio = 0) =>
  buildCategoryScores(
    { rms: 0, rmsDb },
    { clippingRatio, peak: 0 },
    { noiseFloor: 0, snrDb, humRatio },
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
    expect(scores.level.description).toBe("Clipping detected");
  });

  it("marks extremely quiet input as severe", () => {
    const scores = buildScores(ANALYSIS_CONFIG.minRmsDbSevere - 1, ANALYSIS_CONFIG.snrGoodDb);

    expect(scores.level.stars).toBe(1);
    expect(scores.level.description).toBe("Extremely quiet");
  });

  it("marks off-target level as acceptable", () => {
    const scores = buildScores(ANALYSIS_CONFIG.targetRmsDb - ANALYSIS_CONFIG.targetRangeDb - 1, ANALYSIS_CONFIG.snrGoodDb);

    expect(scores.level.stars).toBe(4);
    expect(scores.level.description).toBe("Slightly off target");
  });

  it("uses the 5-tier SNR grading without hum", () => {
    const scores = buildScores(ANALYSIS_CONFIG.targetRmsDb, ANALYSIS_CONFIG.snrFairDb + 1);

    expect(scores.noise.stars).toBe(3);
    expect(scores.noise.description).toBe("Some background noise");
  });

  it("prioritizes hum detection over SNR tiers", () => {
    const scores = buildScores(
      ANALYSIS_CONFIG.targetRmsDb,
      ANALYSIS_CONFIG.snrExcellentDb,
      0,
      ANALYSIS_CONFIG.humWarningRatio + 0.01
    );

    expect(scores.noise.stars).toBe(2);
    expect(scores.noise.description).toBe("Electrical hum detected");
  });
});
