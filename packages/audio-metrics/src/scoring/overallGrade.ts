import type { CategoryId, CategoryScores, GradeLetter, MetricsSummary } from "../types";
import { ANALYSIS_CONFIG } from "../config";

const gradeFromStars = (stars: number): GradeLetter => {
  switch (stars) {
    case 5:
      return "A";
    case 4:
      return "B";
    case 3:
      return "C";
    case 2:
      return "D";
    case 1:
      return "F";
    default:
      return "F";
  }
};

const getPrimaryIssue = (
  metrics: MetricsSummary
): { category: CategoryId; reason: string; fix: string } => {
  if (metrics.clippingRatio > ANALYSIS_CONFIG.clippingRatioWarning) {
    return {
      category: "clipping",
      reason: "Clipping is distorting the audio signal.",
      fix: "Lower the input gain or move farther from the microphone."
    };
  }

  if (metrics.echoScore > ANALYSIS_CONFIG.echoWarningScore) {
    return {
      category: "echo",
      reason: "Echo is noticeably affecting clarity.",
      fix: "Add soft furnishings or move closer to the microphone to reduce reflections."
    };
  }

  if (metrics.snrDb < ANALYSIS_CONFIG.snrFairDb) {
    return {
      category: "noise",
      reason: "Background noise is overpowering the voice.",
      fix: "Reduce ambient noise or use a closer, directional microphone."
    };
  }

  if (metrics.rmsDb < ANALYSIS_CONFIG.minRmsDb) {
    return {
      category: "level",
      reason: "The recording is too quiet to be clear.",
      fix: "Increase input gain or move closer to the microphone."
    };
  }

  if (metrics.rmsDb > ANALYSIS_CONFIG.maxRmsDb) {
    return {
      category: "level",
      reason: "The recording is too loud and may distort.",
      fix: "Lower the input gain or move back from the microphone."
    };
  }

  return {
    category: "level",
    reason: "Levels are balanced with minimal noise, echo, or clipping.",
    fix: "Keep your current setup for consistent results."
  };
};

/**
 * Determine the overall letter grade based on the weakest category.
 */
export const computeOverallGrade = (
  scores: CategoryScores,
  metrics: MetricsSummary
): { grade: GradeLetter; primaryIssueCategory: CategoryId; explanation: string } => {
  const minStars = Math.min(scores.level.stars, scores.noise.stars, scores.echo.stars);
  const primaryIssue = getPrimaryIssue(metrics);

  const grade = minStars > 0 ? gradeFromStars(minStars) : "F";

  return {
    grade,
    primaryIssueCategory: primaryIssue.category,
    explanation: primaryIssue.reason
  };
};
