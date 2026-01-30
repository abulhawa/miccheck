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
      message: "Reduce input gain or move slightly farther from the mic to prevent clipping.",
      confidence: 0.9
    };
  }
  if (noise.snrDb < ANALYSIS_CONFIG.snrMinDb || noise.humRatio > ANALYSIS_CONFIG.humWarningRatio) {
    return {
      category: "Noise",
      message: "Lower background noise by turning off fans or switching to a quieter room.",
      confidence: 0.82
    };
  }
  if (echo.echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return {
      category: "Echo",
      message: "Add soft furnishings or close doors to reduce echo reflections.",
      confidence: 0.77
    };
  }
  if (level.rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return {
      category: "Volume",
      message: "Increase mic gain or move closer to the microphone.",
      confidence: 0.7
    };
  }
  return {
    category: "General",
    message: "Your microphone sounds solid. Keep consistent distance and speak clearly.",
    confidence: 0.6
  };
};
