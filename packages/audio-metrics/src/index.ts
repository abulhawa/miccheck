import { detectVoiceActivity } from "@miccheck/audio-core";
import { measureClipping } from "./metrics/clipping";
import { measureLevel } from "./metrics/level";
import { measureNoise } from "./metrics/noise";
import { measureEcho } from "./metrics/echo";
import { buildRecommendationPolicy, buildVerdictNextSteps, recommendFix } from "./diagnosis/recommendations";
import { getNoSpeechVerdict, getVerdict } from "./scoring/verdict";
import { evaluateMetrics } from "./policy/evaluateMetrics";
import { buildSecondaryNotes } from "./policy/secondaryNotes";
import type { AnalysisSummary, ContextInput, DiagnosticCertainty, UseCaseFit, Verdict } from "./types";

export * from "./types";
export * from "./useCaseLabels";
export { getContextualExplanation } from "./scoring/contextHelp";
export { getVerdict } from "./scoring/verdict";

const DEFAULT_CONTEXT: ContextInput = {
  use_case: "meetings",
  device_type: "unknown",
  mode: "single"
};

const fitFromGrade = (grade: string): UseCaseFit => {
  if (["A", "A-", "B"].includes(grade)) return "pass";
  if (grade === "C") return "warn";
  return "fail";
};

const certaintyFrom = (fit: UseCaseFit, deviceType: ContextInput["device_type"]): DiagnosticCertainty => {
  const base: DiagnosticCertainty = fit === "pass" ? "high" : fit === "warn" ? "medium" : "low";
  if (deviceType === "unknown" && base === "high") return "medium";
  return base;
};

const withVerdictExtensions = (verdict: Verdict, context: ContextInput): Verdict => {
  const fit = fitFromGrade(verdict.overall.grade);
  const diagnosticCertainty = certaintyFrom(fit, context.device_type);
  const reassuranceMode = fit === "pass";

  return {
    ...verdict,
    context,
    useCaseFit: fit,
    diagnosticCertainty,
    reassuranceMode
  };
};

/**
 * Analyze PCM samples and return a summary of metrics and recommendations.
 */
export const analyzeSamples = (
  samples: Float32Array,
  sampleRate: number,
  context?: Partial<ContextInput>
): AnalysisSummary => {
  const resolvedContext: ContextInput = {
    ...DEFAULT_CONTEXT,
    ...context
  };

  // Gate analysis when speech is not present to avoid false negatives.
  const vadResult = detectVoiceActivity(samples, sampleRate);
  const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));
  const speechRmsDb = toDb(vadResult.averageSpeechRms);
  if (vadResult.speechRatio < 0.1) {
    const verdict = withVerdictExtensions(getNoSpeechVerdict(resolvedContext), resolvedContext);
    return {
      verdict,
      metrics: {
        clippingRatio: 0,
        rmsDb: 0,
        speechRmsDb,
        snrDb: 0,
        humRatio: 0,
        echoScore: 0
      },
      recommendation: {
        category: "General",
        messageKey: "recommendation.no_speech",
        confidence: 1
      },
      specialState: "NO_SPEECH"
    };
  }
  const clipping = measureClipping(samples);
  const level = measureLevel(samples);
  const noise = measureNoise(samples, sampleRate);
  const echo = measureEcho(samples, sampleRate);

  const baseVerdict = getVerdict(
    {
      clippingRatio: clipping.clippingRatio,
      rmsDb: level.rmsDb,
      speechRmsDb,
      snrDb: noise.snrDb,
      humRatio: noise.humRatio,
      echoScore: echo.echoScore
    },
    resolvedContext
  );
  const recommendationPolicy = buildRecommendationPolicy(level, clipping, noise, echo, resolvedContext);
  const recommendation = recommendFix(level, clipping, noise, echo, resolvedContext);

  const verdict = withVerdictExtensions(baseVerdict, resolvedContext);
  verdict.bestNextSteps = verdict.reassuranceMode ? [] : buildVerdictNextSteps(recommendationPolicy);

  const metricStatuses = evaluateMetrics({
    rmsDb: level.rmsDb,
    snrDb: noise.snrDb,
    echoScore: echo.echoScore,
    clippingRatio: clipping.clippingRatio,
    humRatio: noise.humRatio
  }, resolvedContext.use_case);

  verdict.secondaryNotes = buildSecondaryNotes({
    metricStatuses,
    context: {
      useCase: resolvedContext.use_case,
      deviceType: resolvedContext.device_type
    },
    primaryUseCaseFit: verdict.useCaseFit ?? "fail",
    evaluateUseCaseFit: (useCase) =>
      evaluateMetrics(
        {
          rmsDb: level.rmsDb,
          snrDb: noise.snrDb,
          echoScore: echo.echoScore,
          clippingRatio: clipping.clippingRatio,
          humRatio: noise.humRatio
        },
        useCase === "music" ? "podcast" : useCase
      )
  });

  return {
    verdict,
    metrics: {
      clippingRatio: clipping.clippingRatio,
      rmsDb: level.rmsDb,
      speechRmsDb,
      snrDb: noise.snrDb,
      humRatio: noise.humRatio,
      echoScore: echo.echoScore
    },
    recommendation
  };
};
