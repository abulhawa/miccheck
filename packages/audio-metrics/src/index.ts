import { detectVoiceActivity } from "@miccheck/audio-core";
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
  const vadResult = detectVoiceActivity(samples, sampleRate);
  if (vadResult.speechRatio < 0.1) {
    return {
      grade: "F",
      summary: "No clear speech detected.",
      categories: {
        level: { stars: 0, label: "Level", description: "No speech detected." },
        noise: { stars: 0, label: "Noise", description: "No speech detected." },
        echo: { stars: 0, label: "Echo", description: "No speech detected." }
      },
      metrics: {
        clippingRatio: 0,
        rmsDb: 0,
        snrDb: 0,
        humRatio: 0,
        echoScore: 0
      },
      primaryIssueCategory: "Level",
      primaryIssueExplanation: "No clear speech detected.",
      recommendation: {
        category: "General",
        message: "Please speak closer to the microphone or check if your mic is muted.",
        confidence: 1
      },
      primaryFix: {
        title: "No clear speech detected",
        description: "Please speak closer to the microphone or check if your mic is muted.",
        priority: "critical"
      },
      specialState: "NO_SPEECH"
    };
  }
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
  const primaryIssue = Object.values(categories).reduce((lowest, current) =>
    current.stars < lowest.stars ? current : lowest
  );
  const primaryIssueCategory = primaryIssue.label;
  const primaryIssueExplanation = `Your grade is mainly affected by ${primaryIssueCategory}`;

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
    primaryIssueCategory,
    primaryIssueExplanation,
    recommendation
  };
};
