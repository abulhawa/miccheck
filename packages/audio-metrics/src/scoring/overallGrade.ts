import type { CategoryScores, GradeLetter, MetricsSummary } from "../types";
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
    default:
      return "E";
  }
};

/**
 * Determine the overall letter grade based on the weakest category.
 */
export const computeOverallGrade = (
  scores: CategoryScores,
  metrics: MetricsSummary
): GradeLetter => {
  const minStars = Math.min(scores.level.stars, scores.noise.stars, scores.echo.stars);
  if (minStars > 1) {
    return gradeFromStars(minStars);
  }

  const isSevere =
    metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere ||
    metrics.snrDb <= ANALYSIS_CONFIG.snrSevereDb ||
    metrics.echoScore >= ANALYSIS_CONFIG.echoSevereScore ||
    metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDbSevere ||
    metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDbSevere;

  return isSevere ? "F" : "E";
};
