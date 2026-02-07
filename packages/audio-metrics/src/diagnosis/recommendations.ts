import type { ClippingMetrics } from "../metrics/clipping";
import type { NoiseMetrics } from "../metrics/noise";
import type { EchoMetrics } from "../metrics/echo";
import type { LevelMetrics } from "../metrics/level";
import type { CategoryId, ContextInput, Recommendation, VerdictBestNextStep } from "../types";
import { buildVerdict } from "../policy/buildVerdict";
import { recommendationMessageFor } from "../policy/copy";
import { buildAdviceSteps, type AdviceStep } from "../policy/adviceSteps";
import { buildGearStep, type GearRelevance, type GearStep } from "../policy/gearPolicy";
import { interpretLevel } from "../scoring/levelInterpretation";

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

const adviceStepTitle: Record<AdviceStep["key"], string> = {
  adjust_input_gain: "Adjust microphone input gain.",
  move_mic_closer: "Move closer to the microphone.",
  increase_distance_from_mic: "Move slightly farther from the microphone.",
  reduce_background_noise: "Reduce background noise around your setup.",
  treat_room_echo: "Add soft furnishings to reduce room reflections.",
  enable_echo_cancellation: "Enable echo cancellation in your calling or recording app.",
  reposition_mic_away_from_speakers: "Reposition your mic away from speakers and reflective surfaces.",
  check_system_mic_level: "Check your system microphone level.",
  check_app_input_level: "Check your app input level.",
  disable_audio_enhancements: "Disable audio enhancements.",
  disable_auto_volume: "Disable auto-volume controls.",
  speak_louder: "Speak a bit louder into the mic.",
  speak_softer: "Speak a bit softer to avoid overload.",
  keep_headset_mic_facing_mouth: "Keep your headset mic facing your mouth.",
  keep_head_angle_stable: "Keep your head angle stable while speaking.",
  check_charger_interference: "Check charger interference.",
  check_power_interference: "Move away from power interference.",
  check_usb_port_interference: "Try a different USB port.",
  check_cables_grounding: "Check cables and grounding.",
  consider_external_mic: "Consider an external microphone."
};

const toBestNextSteps = (steps: Array<AdviceStep | GearStep>): VerdictBestNextStep[] =>
  steps.map((step) => {
    if (step.key === "consider_external_mic" && "category" in step && "rationale" in step) {
      return {
        kind: "gear_optional",
        title: `Optional gear: ${step.title}`,
        description: step.rationale,
        gear: {
          id: step.id,
          title: step.title,
          why: step.why,
          category: step.category,
          relevance: step.relevance,
          rationale: step.rationale,
          supportsIssues: step.supportsIssues,
          ...(step.affiliateUrl ? { affiliateUrl: step.affiliateUrl } : {}),
          linkStatus: step.linkStatus
        }
      } satisfies VerdictBestNextStep;
    }

    return {
      kind: "action",
      title: adviceStepTitle[step.key]
    } satisfies VerdictBestNextStep;
  });

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

  const levelInterpretation = interpretLevel({
    rmsDb: level.rmsDb,
    clippingRatio: clipping.clippingRatio,
    humRatio: noise.humRatio,
    useCase: resolvedContext.use_case
  });
  const hasHum = noise.humRatio > 0.08;
  const constrainedAdviceSteps = buildAdviceSteps(verdict.primaryIssue, {
    isQuiet: levelInterpretation.levelAdviceEnabled && level.rmsDb < -18,
    hasHum,
    clippingDetected: clipping.clippingRatio >= 0.03,
    echoScore: echo.echoScore,
    useCase: resolvedContext.use_case,
    deviceType: resolvedContext.device_type,
    diagnosticCertainty: certainty
  });

  const relevance = gearRelevanceFrom(verdict.primaryIssue);
  const gearIssue: CategoryId = verdict.primaryIssue ?? "level";
  const allowGear =
    !(certainty === "low" && resolvedContext.device_type === "unknown") &&
    (resolvedContext.use_case !== "meetings" ||
      (fit === "fail" && severity === "high"));
  const gearSteps = allowGear
    ? buildGearStep(
        relevance,
        gearIssue,
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

export const buildVerdictNextSteps = (
  policy: RecommendationPolicyOutput
): VerdictBestNextStep[] => toBestNextSteps(policy.adviceSteps);

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
