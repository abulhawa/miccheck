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
    default:
      return "E";
  }
};

/**
 * Determine the overall letter grade based on the weakest category.
 */
const getSeverityByCategory = (metrics: MetricsSummary) => ({
  level: Math.max(
    metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere ? 3 : 0,
    metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDbSevere ||
      metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDbSevere
      ? 3
      : metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDb ||
          metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDb
        ? 2
        : 0
  ),
  noise: Math.max(
    metrics.snrDb <= ANALYSIS_CONFIG.snrSevereDb
      ? 3
      : metrics.snrDb <= ANALYSIS_CONFIG.snrMinDb
        ? 2
        : 0,
    metrics.humRatio >= ANALYSIS_CONFIG.humWarningRatio ? 2 : 0
  ),
  echo:
    metrics.echoScore >= ANALYSIS_CONFIG.echoSevereScore
      ? 3
      : metrics.echoScore >= ANALYSIS_CONFIG.echoWarningScore
        ? 2
        : 0,
  clipping:
    metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere
      ? 3
      : metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioWarning
        ? 2
        : 0
});

const getExplanation = (primaryIssueCategory: CategoryId, metrics: MetricsSummary): string => {
  switch (primaryIssueCategory) {
    case "clipping":
      if (metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere) {
        return "Clipping is severely distorting the audio signal.";
      }
      return "Clipping is distorting the audio signal.";
    case "level":
      if (metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere) {
        return "Clipping is severely distorting the audio signal.";
      }
      if (metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioWarning) {
        return "Clipping is distorting the audio signal.";
      }
      if (metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDbSevere) {
        return "The recording is extremely quiet and hard to understand.";
      }
      if (metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDbSevere) {
        return "The recording is extremely loud and likely distorted.";
      }
      if (metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDb) {
        return "The recording is too quiet, reducing clarity.";
      }
      if (metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDb) {
        return "The recording is too loud, which can cause distortion.";
      }
      return "Volume levels are slightly off target.";
    case "noise":
      if (metrics.snrDb <= ANALYSIS_CONFIG.snrSevereDb) {
        return "Background noise is significantly reducing clarity.";
      }
      if (metrics.snrDb <= ANALYSIS_CONFIG.snrMinDb) {
        return "Background noise is noticeable and lowering clarity.";
      }
      if (metrics.humRatio >= ANALYSIS_CONFIG.humWarningRatio) {
        return "A persistent hum is reducing clarity.";
      }
      return "Background noise is affecting speech clarity.";
    case "echo":
    default:
      if (metrics.echoScore >= ANALYSIS_CONFIG.echoSevereScore) {
        return "Echo is overwhelming and smearing speech details.";
      }
      if (metrics.echoScore >= ANALYSIS_CONFIG.echoWarningScore) {
        return "Echo is noticeably affecting clarity.";
      }
      return "Room reflections are softening speech clarity.";
  }
};

/**
 * Determine the overall letter grade based on the weakest category.
 */
export const computeOverallGrade = (
  scores: CategoryScores,
  metrics: MetricsSummary
): { grade: GradeLetter; primaryIssueCategory: CategoryId; explanation: string } => {
  const minStars = Math.min(scores.level.stars, scores.noise.stars, scores.echo.stars);
  const severityByCategory = getSeverityByCategory(metrics);
  const hasSevereMetric = Object.values(severityByCategory).some((severity) => severity >= 3);
  const categories: Array<{ id: CategoryId; stars: number }> = [
    { id: "level", stars: scores.level.stars },
    { id: "noise", stars: scores.noise.stars },
    { id: "echo", stars: scores.echo.stars }
  ];
  const primaryIssueCategory = hasSevereMetric
    ? (Object.entries(severityByCategory).reduce(
        (worst, [label, severity]) =>
          severity > worst.severity
            ? { label: label as CategoryId, severity }
            : worst,
        { label: "level" as CategoryId, severity: -1 }
      ).label as CategoryId)
    : categories
        .filter((category) => category.stars === minStars)
        .reduce((worst, category) =>
          severityByCategory[category.id] > severityByCategory[worst.id]
            ? category
            : worst
        ).id;

  const isSevere =
    metrics.clippingRatio >= ANALYSIS_CONFIG.clippingRatioSevere ||
    metrics.snrDb <= ANALYSIS_CONFIG.snrSevereDb ||
    metrics.echoScore >= ANALYSIS_CONFIG.echoSevereScore ||
    metrics.rmsDb <= ANALYSIS_CONFIG.minRmsDbSevere ||
    metrics.rmsDb >= ANALYSIS_CONFIG.maxRmsDbSevere;

  const grade = minStars > 1 ? gradeFromStars(minStars) : isSevere ? "F" : "E";

  return {
    grade,
    primaryIssueCategory,
    explanation: getExplanation(primaryIssueCategory, metrics)
  };
};
