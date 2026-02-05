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

const fitFromGrade = (grade: string): "pass" | "warn" | "fail" => {
  if (["A", "A-", "B"].includes(grade)) return "pass";
  if (grade === "C") return "warn";
  return "fail";
};

const certaintyFrom = (
  fit: "pass" | "warn" | "fail",
  deviceType: ContextInput["device_type"]
): "low" | "medium" | "high" => {
  const base = fit === "pass" ? "high" : fit === "warn" ? "medium" : "low";
  if (deviceType === "unknown" && base === "high") return "medium";
  return base;
};

const severityFrom = (verdict: ReturnType<typeof buildVerdict>): "low" | "medium" | "high" => {
  const minStars = Math.min(
    verdict.dimensions.level.stars,
    verdict.dimensions.noise.stars,
    verdict.dimensions.echo.stars
  );
  if (minStars <= 2) return "high";
  if (minStars === 3) return "medium";
  return "low";
};

const gearRelevanceFrom = (
  primaryIssue: ReturnType<typeof buildVerdict>["primaryIssue"]
): GearRelevance => {
  if (primaryIssue === "echo") return "high";
  if (primaryIssue === "noise") return "medium";
  return "low";
};

const lowCertaintyChecks = (deviceType: ContextInput["device_type"]): AdviceStep[] => {
  if (deviceType === "bluetooth") {
    return [
      { key: "check_system_mic_level" },
      { key: "check_app_input_level" },
      { key: "keep_headset_mic_facing_mouth" }
    ];
  }

  if (deviceType === "built_in") {
    return [
      { key: "check_system_mic_level" },
      { key: "disable_audio_enhancements" },
      { key: "disable_auto_volume" }
    ];
  }

  return [
    { key: "check_system_mic_level" },
    { key: "check_app_input_level" },
    { key: "move_mic_closer" }
  ];
};

export const buildRecommendationPolicy = (
  level: LevelMetrics,
  clipping: ClippingMetrics,
  noise: NoiseMetrics,
  echo: EchoMetrics,
  context?: ContextInput
): RecommendationPolicyOutput => {
  const resolvedContext: ContextInput = {
    mode: context?.mode ?? "single",
    use_case: context?.use_case ?? "meetings",
    device_type: context?.device_type ?? "unknown"
  };

  const verdict = buildVerdict(
    {
      clippingRatio: clipping.clippingRatio,
      rmsDb: level.rmsDb,
      speechRmsDb: level.rmsDb,
      snrDb: noise.snrDb,
      humRatio: noise.humRatio,
      echoScore: echo.echoScore
    },
    resolvedContext
  );

  const category: Recommendation["category"] =
    verdict.primaryIssue === "level"
      ? "Volume"
      : verdict.primaryIssue === "noise"
        ? "Noise"
        : verdict.primaryIssue === "echo"
          ? "Echo"
          : "General";

  const fit = fitFromGrade(verdict.overall.grade);
  const certainty = certaintyFrom(fit, resolvedContext.device_type);
  const severity = severityFrom(verdict);

  const hasHum = noise.humRatio > 0.08;
  const humChecks = hasHum
    ? buildAdviceSteps("noise", {
        isQuiet: level.rmsDb < -18,
        hasHum,
        deviceType: resolvedContext.device_type
      })
    : [];

  const baseAdviceSteps =
    hasHum
      ? humChecks
      : certainty === "low"
        ? lowCertaintyChecks(resolvedContext.device_type)
        : buildAdviceSteps(verdict.primaryIssue, {
            isQuiet: level.rmsDb < -18,
            hasHum,
            deviceType: resolvedContext.device_type
          });
  const constrainedAdviceSteps = applyDeviceConstraints(baseAdviceSteps, resolvedContext);

  const relevance = gearRelevanceFrom(verdict.primaryIssue);
  const allowGear =
    resolvedContext.use_case !== "meetings" ||
    (fit === "fail" && severity === "high");
  const gearSteps = allowGear
    ? buildGearStep(
        relevance,
        verdict.primaryIssue === "noise" ? "USB dynamic mic" : "USB condenser mic",
        verdict.primaryIssue === "noise"
          ? "Improves background rejection when noise is limiting clarity"
          : "Improves speech pickup consistency for this failing metric"
      )
    : [];

  return {
    category,
    messageKey: recommendationMessageFor(verdict.primaryIssue, level.rmsDb < -18),
    confidence: certainty === "high" ? 0.9 : certainty === "medium" ? 0.78 : 0.6,
    adviceSteps: [...constrainedAdviceSteps, ...gearSteps]
  };
};

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
