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
  if (rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return { stars: 2, description: "Too quiet" };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDb) {
    return { stars: 2, description: "Too loud" };
  }
  if (rmsDb < ANALYSIS_CONFIG.targetRmsDb - 4 || rmsDb > ANALYSIS_CONFIG.targetRmsDb + 4) {
    return { stars: 4, description: "Slightly off target" };
  }
  return { stars: 5, description: "Great level" };
};

const describeNoise = (snrDb: number, humRatio: number): { stars: number; description: string } => {
  if (snrDb < ANALYSIS_CONFIG.snrMinDb || humRatio > ANALYSIS_CONFIG.humWarningRatio) {
    return { stars: 2, description: "Noticeable background noise" };
  }
  if (snrDb < ANALYSIS_CONFIG.snrGoodDb) {
    return { stars: 3, description: "Some background noise" };
  }
  return { stars: 5, description: "Clean background" };
};

const describeEcho = (echoScore: number): { stars: number; description: string } => {
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
