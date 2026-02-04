import { ANALYSIS_CONFIG } from "../config";
import type { ClippingMetrics } from "../metrics/clipping";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";
import type { LevelMetrics } from "../metrics/level";
import type { Recommendation } from "../types";

/**
 * Return a single prioritized fix recommendation.
 */
export const recommendFix = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics
): Recommendation => {
  if (clipping.clippingRatio > ANALYSIS_CONFIG.clippingRatioWarning) {
    return {
      category: "Clipping",
      messageKey: "recommendation.reduce_clipping",
      confidence: 0.9
    };
  }
  if (noise.snrDb < ANALYSIS_CONFIG.snrFairDb || noise.humRatio > ANALYSIS_CONFIG.humWarningRatio) {
    return {
      category: "Noise",
      messageKey: "recommendation.reduce_noise",
      confidence: 0.82
    };
  }
  if (echo.echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return {
      category: "Echo",
      messageKey: "recommendation.reduce_echo",
      confidence: 0.77
    };
  }
  if (level.rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return {
      category: "Volume",
      messageKey: "recommendation.raise_volume",
      confidence: 0.7
    };
  }
  return {
    category: "General",
    messageKey: "recommendation.keep_consistent",
    confidence: 0.6
  };
};
