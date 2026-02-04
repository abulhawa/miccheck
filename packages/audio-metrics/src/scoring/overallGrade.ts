import type {
  CategoryId,
  GradeLetter,
  MetricsSummary,
  VerdictExplanationKey,
  VerdictFixKey
} from "../types";
import { describeEcho, describeLevel, describeNoise } from "./categoryScores";

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

/**
 * Determine the overall letter grade based on the weakest category.
 */
export const computeOverallGrade = (
  metrics: MetricsSummary
): {
  grade: GradeLetter;
  primaryIssueCategory: CategoryId;
  explanationKey: VerdictExplanationKey;
  fixKey: VerdictFixKey;
} => {
  const level = describeLevel(metrics.rmsDb, metrics.clippingRatio);
  const noise = describeNoise(metrics.snrDb, metrics.humRatio);
  const echo = describeEcho(metrics.echoScore);

  const minStars = Math.min(level.stars, noise.stars, echo.stars);
  const grade = minStars > 0 ? gradeFromStars(minStars) : "F";

  const levelIsMin = level.stars === minStars;
  const noiseIsMin = noise.stars === minStars;
  const echoIsMin = echo.stars === minStars;

  let primaryCategory: CategoryId = "level";
  let primaryInsight = level;

  if (levelIsMin && level.isCatastrophic) {
    primaryCategory = "level";
    primaryInsight = level;
  } else if (echoIsMin) {
    primaryCategory = "echo";
    primaryInsight = echo;
  } else if (noiseIsMin) {
    primaryCategory = "noise";
    primaryInsight = noise;
  } else if (levelIsMin) {
    primaryCategory = "level";
    primaryInsight = level;
  }

  const explanationKey =
    primaryInsight.reasonKey ?? primaryInsight.descriptionKey;
  const fixKey =
    primaryInsight.fixKey ?? (minStars >= 4 ? "fix.keep_setup" : "fix.targeted_adjustments");

  return {
    grade,
    primaryIssueCategory: primaryCategory,
    explanationKey,
    fixKey
  };
};
