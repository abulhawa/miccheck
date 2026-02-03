import type { CategoryScores } from "../types";
import { ANALYSIS_CONFIG } from "../config";
import type { ClippingMetrics } from "../metrics/clipping";
import type { LevelMetrics } from "../metrics/level";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";

const clampStars = (value: number) => Math.max(1, Math.min(5, value));

export interface CategoryInsight {
  stars: number;
  description: string;
  reason?: string;
  fix?: string;
  isCatastrophic?: boolean;
}

export const describeLevel = (rmsDb: number, clippingRatio: number): CategoryInsight => {
  if (clippingRatio > ANALYSIS_CONFIG.clippingRatioWarning) {
    return {
      stars: 1,
      description: "Clipping detected",
      reason: "Clipping is distorting the audio signal.",
      fix: "Lower the input gain or move farther from the microphone.",
      isCatastrophic: true
    };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDbSevere) {
    return {
      stars: 1,
      description: "Extremely quiet",
      reason: "The recording is extremely quiet and hard to understand.",
      fix: "Increase input gain or move closer to the microphone.",
      isCatastrophic: true
    };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDbSevere) {
    return {
      stars: 1,
      description: "Extremely loud",
      reason: "The recording is extremely loud and likely distorting.",
      fix: "Lower the input gain or move back from the microphone.",
      isCatastrophic: true
    };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return {
      stars: 2,
      description: "Too quiet",
      reason: "The recording is too quiet to be clear.",
      fix: "Increase input gain or move closer to the microphone."
    };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDb) {
    return {
      stars: 2,
      description: "Too loud",
      reason: "The recording is too loud and may distort.",
      fix: "Lower the input gain or move back from the microphone."
    };
  }
  const targetRange = ANALYSIS_CONFIG.targetRangeDb;
  const innerRange = targetRange / 2;
  if (
    rmsDb < ANALYSIS_CONFIG.targetRmsDb - targetRange ||
    rmsDb > ANALYSIS_CONFIG.targetRmsDb + targetRange
  ) {
    return {
      stars: 3,
      description: "Noticeably off target",
      reason: "Levels are noticeably off the ideal range.",
      fix: "Nudge your input gain toward the target level."
    };
  }
  if (
    rmsDb < ANALYSIS_CONFIG.targetRmsDb - innerRange ||
    rmsDb > ANALYSIS_CONFIG.targetRmsDb + innerRange
  ) {
    return {
      stars: 4,
      description: "Slightly off target"
    };
  }
  return { stars: 5, description: "Excellent level" };
};

export const describeNoise = (snrDb: number, humRatio: number): CategoryInsight => {
  let base: CategoryInsight;

  if (snrDb >= ANALYSIS_CONFIG.snrExcellentDb) {
    base = { stars: 5, description: "Very clean" };
  } else if (snrDb >= ANALYSIS_CONFIG.snrGoodDb) {
    base = { stars: 4, description: "Clean background" };
  } else if (snrDb >= ANALYSIS_CONFIG.snrFairDb) {
    base = {
      stars: 3,
      description: "Some background noise",
      reason: "Background noise is noticeable in the recording.",
      fix: "Reduce ambient noise or move to a quieter space."
    };
  } else if (snrDb >= ANALYSIS_CONFIG.snrPoorDb) {
    base = {
      stars: 2,
      description: "Noisy background",
      reason: "Background noise is competing with the voice.",
      fix: "Reduce ambient noise or use a closer, directional microphone."
    };
  } else {
    base = {
      stars: 1,
      description: "Very noisy",
      reason: "Background noise is overpowering the voice.",
      fix: "Silence the room or use a close mic to improve SNR."
    };
  }

  if (humRatio > ANALYSIS_CONFIG.humWarningRatio && base.stars > 2) {
    return {
      stars: 2,
      description: "Electrical hum detected",
      reason: "Electrical hum is present in the background.",
      fix: "Check cables, grounding, or nearby interference sources."
    };
  }

  return base;
};

export const describeEcho = (echoScore: number): CategoryInsight => {
  if (echoScore > ANALYSIS_CONFIG.echoSevereScore) {
    return {
      stars: 1,
      description: "Overwhelming echo",
      reason: "Severe echo is obscuring speech clarity.",
      fix: "Add acoustic treatment or move much closer to the microphone."
    };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return {
      stars: 2,
      description: "Strong echo",
      reason: "Echo is noticeably affecting clarity.",
      fix: "Add soft furnishings or move closer to the microphone to reduce reflections."
    };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore * 0.7) {
    return {
      stars: 3,
      description: "Some room echo",
      reason: "Room reflections are softening speech detail.",
      fix: "Add light acoustic treatment or close the mic distance."
    };
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
