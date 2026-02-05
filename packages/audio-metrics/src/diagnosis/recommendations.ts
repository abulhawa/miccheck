import type { ClippingMetrics } from "../metrics/clipping";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";
import type { LevelMetrics } from "../metrics/level";
import type { Recommendation } from "../types";
import { buildVerdict } from "../policy/buildVerdict";
import { recommendationMessageFor } from "../policy/copy";

/**
 * Return a single prioritized fix recommendation.
 * @deprecated Prefer policy/buildVerdict.ts for prioritized advice.
 */
export const recommendFix = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics
): Recommendation => {
  const verdict = buildVerdict({
    clippingRatio: clipping.clippingRatio,
    rmsDb: level.rmsDb,
    speechRmsDb: level.rmsDb,
    snrDb: noise.snrDb,
    humRatio: noise.humRatio,
    echoScore: echo.echoScore
  });

  const category =
    verdict.primaryIssue === "level"
      ? "Volume"
      : verdict.primaryIssue === "noise"
        ? "Noise"
        : verdict.primaryIssue === "echo"
          ? "Echo"
          : "General";

  return {
    category,
    messageKey: recommendationMessageFor(verdict.primaryIssue, level.rmsDb < -18),
    confidence:
      verdict.overall.grade === "A"
        ? 0.6
        : verdict.overall.grade === "C"
          ? 0.78
          : 0.9
  };
};
