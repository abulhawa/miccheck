import { measureClipping } from "./metrics/clipping";
import { measureLevel } from "./metrics/level";
import { measureNoise } from "./metrics/noise";
import { measureEcho } from "./metrics/echo";
import { buildCategoryScores } from "./scoring/categoryScores";
import { computeOverallGrade } from "./scoring/overallGrade";
import { recommendFix } from "./diagnosis/recommendations";
import type { AnalysisSummary } from "./types";

export type { AnalysisSummary } from "./types";
export * from "./types";

/**
 * Analyze PCM samples and return a summary of metrics and recommendations.
 */
export const analyzeSamples = (
  samples: Float32Array,
  sampleRate: number
): AnalysisSummary => {
  const clipping = measureClipping(samples);
  const level = measureLevel(samples);
  const noise = measureNoise(samples, sampleRate);
  const echo = measureEcho(samples, sampleRate);

  const categories = buildCategoryScores(level, clipping, noise, echo);
  const grade = computeOverallGrade(categories, {
    clippingRatio: clipping.clippingRatio,
    rmsDb: level.rmsDb,
    snrDb: noise.snrDb,
    humRatio: noise.humRatio,
    echoScore: echo.echoScore
  });
  const recommendation = recommendFix(level, clipping, noise, echo);

  const summary =
    grade === "A"
      ? "Excellent clarity with minimal issues."
      : grade === "B"
        ? "Strong recording with minor improvements possible."
        : grade === "C"
          ? "Fair quality; targeted adjustments will help."
          : grade === "D"
            ? "Noticeable issues impacting clarity."
            : "Severe issues detected. Immediate fixes recommended.";

  return {
    grade,
    summary,
    categories,
    metrics: {
      clippingRatio: clipping.clippingRatio,
      rmsDb: level.rmsDb,
      snrDb: noise.snrDb,
      humRatio: noise.humRatio,
      echoScore: echo.echoScore
    },
    recommendation
  };
};
