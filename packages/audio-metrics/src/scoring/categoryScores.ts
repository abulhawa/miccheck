import type { CategoryScores } from "../types";
import { ANALYSIS_CONFIG } from "../config";
import type { ClippingMetrics } from "../metrics/clipping";
import type { LevelMetrics } from "../metrics/level";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";

const clampStars = (value: number) => Math.max(1, Math.min(5, value));

const describeLevel = (rmsDb: number, clippingRatio: number): { stars: number; description: string } => {
  if (clippingRatio > ANALYSIS_CONFIG.clippingRatioWarning) {
    return { stars: 1, description: "Clipping detected" };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDbSevere) {
    return { stars: 1, description: "Extremely quiet" };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDbSevere) {
    return { stars: 1, description: "Extremely loud" };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return { stars: 2, description: "Too quiet" };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDb) {
    return { stars: 2, description: "Too loud" };
  }
  const targetRange = ANALYSIS_CONFIG.targetRangeDb;
  if (rmsDb < ANALYSIS_CONFIG.targetRmsDb - targetRange ||
      rmsDb > ANALYSIS_CONFIG.targetRmsDb + targetRange) {
    return { stars: 4, description: "Slightly off target" };
  }
  return { stars: 5, description: "Excellent level" };
};

const describeNoise = (snrDb: number, humRatio: number): { stars: number; description: string } => {
  if (humRatio > ANALYSIS_CONFIG.humWarningRatio) {
    return { stars: 2, description: "Electrical hum detected" };
  }
  if (snrDb >= ANALYSIS_CONFIG.snrExcellentDb) {
    return { stars: 5, description: "Very clean" };
  }
  if (snrDb >= ANALYSIS_CONFIG.snrGoodDb) {
    return { stars: 4, description: "Clean background" };
  }
  if (snrDb >= ANALYSIS_CONFIG.snrFairDb) {
    return { stars: 3, description: "Some background noise" };
  }
  if (snrDb >= ANALYSIS_CONFIG.snrPoorDb) {
    return { stars: 2, description: "Noisy background" };
  }
  return { stars: 1, description: "Very noisy" };
};

const describeEcho = (echoScore: number): { stars: number; description: string } => {
  if (echoScore > ANALYSIS_CONFIG.echoSevereScore) {
    return { stars: 1, description: "Overwhelming echo" };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return { stars: 2, description: "Strong echo" };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore * 0.7) {
    return { stars: 3, description: "Some room echo" };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore * 0.4) {
    return { stars: 4, description: "Slight reflections" };
  }
  return { stars: 5, description: "Minimal echo" };
};

/**
 * Convert raw metrics into 1-5 star category scores.
 */
export const buildCategoryScores = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics
): CategoryScores => {
  const levelScore = describeLevel(level.rmsDb, clipping.clippingRatio);
  const noiseScore = describeNoise(noise.snrDb, noise.humRatio);
  const echoScore = describeEcho(echo.echoScore);

  return {
    level: {
      stars: clampStars(levelScore.stars),
      label: "Level",
      description: levelScore.description
    },
    noise: {
      stars: clampStars(noiseScore.stars),
      label: "Noise",
      description: noiseScore.description
    },
    echo: {
      stars: clampStars(echoScore.stars),
      label: "Echo",
      description: echoScore.description
    }
  };
};
