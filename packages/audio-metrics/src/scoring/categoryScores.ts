import type {
  MetricsSummary,
  VerdictCategoryDescriptionKey,
  VerdictDimensions,
  VerdictExplanationKey,
  VerdictFixKey
} from "../types";
import { ANALYSIS_CONFIG } from "../config";
import type { ClippingMetrics } from "../metrics/clipping";
import type { LevelMetrics } from "../metrics/level";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";

const clampStars = (value: number) => Math.max(1, Math.min(5, value));

export interface CategoryInsight {
  stars: number;
  descriptionKey: VerdictCategoryDescriptionKey;
  reasonKey?: VerdictExplanationKey;
  fixKey?: VerdictFixKey;
  isCatastrophic?: boolean;
}

export const describeLevel = (rmsDb: number, clippingRatio: number): CategoryInsight => {
  if (clippingRatio > ANALYSIS_CONFIG.clippingRatioWarning) {
    return {
      stars: 1,
      descriptionKey: "level.clipping_detected",
      reasonKey: "explanation.clipping_distortion",
      fixKey: "fix.lower_gain_move_back",
      isCatastrophic: true
    };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDbSevere) {
    return {
      stars: 1,
      descriptionKey: "level.extremely_quiet",
      reasonKey: "explanation.extremely_quiet",
      fixKey: "fix.increase_gain_move_closer",
      isCatastrophic: true
    };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDbSevere) {
    return {
      stars: 1,
      descriptionKey: "level.extremely_loud",
      reasonKey: "explanation.extremely_loud",
      fixKey: "fix.lower_gain_move_back_slight",
      isCatastrophic: true
    };
  }
  if (rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return {
      stars: 2,
      descriptionKey: "level.too_quiet",
      reasonKey: "explanation.too_quiet",
      fixKey: "fix.increase_gain_move_closer"
    };
  }
  if (rmsDb > ANALYSIS_CONFIG.maxRmsDb) {
    return {
      stars: 2,
      descriptionKey: "level.too_loud",
      reasonKey: "explanation.too_loud",
      fixKey: "fix.lower_gain_move_back_slight"
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
      descriptionKey: "level.noticeably_off_target",
      reasonKey: "explanation.noticeably_off_target",
      fixKey: "fix.nudge_gain"
    };
  }
  if (
    rmsDb < ANALYSIS_CONFIG.targetRmsDb - innerRange ||
    rmsDb > ANALYSIS_CONFIG.targetRmsDb + innerRange
  ) {
    return {
      stars: 4,
      descriptionKey: "level.slightly_off_target"
    };
  }
  return { stars: 5, descriptionKey: "level.excellent" };
};

export const describeNoise = (snrDb: number, humRatio: number): CategoryInsight => {
  let base: CategoryInsight;

  if (snrDb >= ANALYSIS_CONFIG.snrExcellentDb) {
    base = { stars: 5, descriptionKey: "noise.very_clean" };
  } else if (snrDb >= ANALYSIS_CONFIG.snrGoodDb) {
    base = { stars: 4, descriptionKey: "noise.clean_background" };
  } else if (snrDb >= ANALYSIS_CONFIG.snrFairDb) {
    base = {
      stars: 3,
      descriptionKey: "noise.some_background_noise",
      reasonKey: "explanation.some_background_noise",
      fixKey: "fix.reduce_noise_quieter_space"
    };
  } else if (snrDb >= ANALYSIS_CONFIG.snrPoorDb) {
    base = {
      stars: 2,
      descriptionKey: "noise.noisy_background",
      reasonKey: "explanation.noisy_background",
      fixKey: "fix.reduce_noise_directional_mic"
    };
  } else {
    base = {
      stars: 1,
      descriptionKey: "noise.very_noisy",
      reasonKey: "explanation.very_noisy",
      fixKey: "fix.silence_room_close_mic"
    };
  }

  if (humRatio > ANALYSIS_CONFIG.humWarningRatio && base.stars > 2) {
    return {
      stars: 2,
      descriptionKey: "noise.electrical_hum",
      reasonKey: "explanation.electrical_hum",
      fixKey: "fix.check_cables_grounding"
    };
  }

  return base;
};

export const describeEcho = (echoScore: number): CategoryInsight => {
  if (echoScore > ANALYSIS_CONFIG.echoSevereScore) {
    return {
      stars: 1,
      descriptionKey: "echo.overwhelming",
      reasonKey: "explanation.overwhelming_echo",
      fixKey: "fix.add_acoustic_treatment_move_closer"
    };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return {
      stars: 2,
      descriptionKey: "echo.strong",
      reasonKey: "explanation.strong_echo",
      fixKey: "fix.add_soft_furnishings_move_closer"
    };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore * 0.7) {
    return {
      stars: 3,
      descriptionKey: "echo.some_room_echo",
      reasonKey: "explanation.some_room_echo",
      fixKey: "fix.light_acoustic_treatment_close_mic"
    };
  }
  if (echoScore > ANALYSIS_CONFIG.echoWarningScore * 0.4) {
    return { stars: 4, descriptionKey: "echo.slight_reflections" };
  }
  return { stars: 5, descriptionKey: "echo.minimal" };
};

/**
 * Convert raw metrics into 1-5 star category scores.
 */
export const buildCategoryScores = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics
): VerdictDimensions => {
  const levelScore = describeLevel(level.rmsDb, clipping.clippingRatio);
  const noiseScore = describeNoise(noise.snrDb, noise.humRatio);
  const echoScore = describeEcho(echo.echoScore);

  return {
    level: {
      stars: clampStars(levelScore.stars),
      labelKey: "category.level",
      descriptionKey: levelScore.descriptionKey
    },
    noise: {
      stars: clampStars(noiseScore.stars),
      labelKey: "category.noise",
      descriptionKey: noiseScore.descriptionKey
    },
    echo: {
      stars: clampStars(echoScore.stars),
      labelKey: "category.echo",
      descriptionKey: echoScore.descriptionKey
    }
  };
};

export const buildVerdictDimensionsFromMetrics = (
  metrics: Pick<MetricsSummary, "rmsDb" | "clippingRatio" | "snrDb" | "humRatio" | "echoScore">
): VerdictDimensions =>
  buildCategoryScores(
    { rms: 0, rmsDb: metrics.rmsDb },
    { clippingRatio: metrics.clippingRatio, peak: 0 },
    { noiseFloor: 0, snrDb: metrics.snrDb, humRatio: metrics.humRatio, confidence: "low" },
    { echoScore: metrics.echoScore, confidence: "low" }
  );
