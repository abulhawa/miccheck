import { detectVoiceActivity } from "@miccheck/audio-core";
import { measureClipping } from "./metrics/clipping";
import { measureLevel } from "./metrics/level";
import { measureNoise } from "./metrics/noise";
import { measureEcho } from "./metrics/echo";
import { recommendFix } from "./diagnosis/recommendations";
import { getNoSpeechVerdict, getVerdict } from "./scoring/verdict";
import type { AnalysisSummary } from "./types";

export type { AnalysisSummary } from "./types";
export * from "./types";
export { getContextualExplanation } from "./scoring/contextHelp";
export { getVerdict } from "./scoring/verdict";

/**
 * Analyze PCM samples and return a summary of metrics and recommendations.
 */
export const analyzeSamples = (
  samples: Float32Array,
  sampleRate: number
): AnalysisSummary => {
  // Gate analysis when speech is not present to avoid false negatives.
  const vadResult = detectVoiceActivity(samples, sampleRate);
  const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));
  const speechRmsDb = toDb(vadResult.averageSpeechRms);
  if (vadResult.speechRatio < 0.1) {
    const verdict = getNoSpeechVerdict();
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

  const verdict = getVerdict({
    clippingRatio: clipping.clippingRatio,
    rmsDb: level.rmsDb,
    speechRmsDb,
    snrDb: noise.snrDb,
    humRatio: noise.humRatio,
    echoScore: echo.echoScore
  });
  const recommendation = recommendFix(level, clipping, noise, echo);

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
