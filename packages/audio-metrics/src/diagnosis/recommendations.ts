import type { ClippingMetrics } from "../metrics/clipping";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";
import type { LevelMetrics } from "../metrics/level";
import type { ContextInput, Recommendation } from "../types";
import { buildVerdict } from "../policy/buildVerdict";
import { recommendationMessageFor } from "../policy/copy";
import { buildAdviceSteps, type AdviceStep } from "../policy/adviceSteps";
import { applyDeviceConstraints } from "../policy/deviceConstraints";
import { buildGearStep, type GearRelevance, type GearStep } from "../policy/gearPolicy";

export interface RecommendationPolicyOutput {
  category: Recommendation["category"];
  messageKey: Recommendation["messageKey"];
  confidence: number;
  adviceSteps: Array<AdviceStep | GearStep>;
}

const gearRelevanceFrom = (primaryIssue: ReturnType<typeof buildVerdict>["primaryIssue"]): GearRelevance => {
  if (primaryIssue === "echo") return "high";
  if (primaryIssue === "noise") return "medium";
  return "low";
};

export const buildRecommendationPolicy = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics,
  context?: ContextInput
): RecommendationPolicyOutput => {
  const verdict = buildVerdict(
    {
      clippingRatio: clipping.clippingRatio,
      rmsDb: level.rmsDb,
      speechRmsDb: level.rmsDb,
      snrDb: noise.snrDb,
      humRatio: noise.humRatio,
      echoScore: echo.echoScore
    },
    context
  );

  const category: Recommendation["category"] =
    verdict.primaryIssue === "level"
      ? "Volume"
      : verdict.primaryIssue === "noise"
        ? "Noise"
        : verdict.primaryIssue === "echo"
          ? "Echo"
          : "General";

  const baseAdviceSteps = buildAdviceSteps(verdict.primaryIssue, {
    isQuiet: level.rmsDb < -18
  });
  const constrainedAdviceSteps = applyDeviceConstraints(baseAdviceSteps, context);
  const relevance = gearRelevanceFrom(verdict.primaryIssue);
  const gearSteps = buildGearStep(relevance);

  return {
    category,
    messageKey: recommendationMessageFor(verdict.primaryIssue, level.rmsDb < -18),
    confidence:
      verdict.overall.grade === "A"
        ? 0.6
        : verdict.overall.grade === "C"
          ? 0.78
          : 0.9,
    adviceSteps: [...constrainedAdviceSteps, ...gearSteps]
  };
};

/**
 * Return a single prioritized fix recommendation.
 * @deprecated Prefer policy/buildVerdict.ts for prioritized advice.
 */
export const recommendFix = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics,
  context?: ContextInput
): Recommendation => {
  const policy = buildRecommendationPolicy(level, clipping, noise, echo, context);

  return {
    category: policy.category,
    messageKey: policy.messageKey,
    confidence: policy.confidence
  };
};
