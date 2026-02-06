import type {
  CategoryId,
  ImpactKey,
  ImpactSummaryKey,
  RecommendationCopyKey,
  VerdictCategoryDescriptionKey,
  VerdictExplanationKey,
  VerdictFixKey
} from "../types";
import type { CategoryInsight } from "../scoring/categoryScores";
import type { MetricResult } from "./evaluateMetrics";

export const explanationKeyFor = (
  primaryIssue: CategoryId | null,
  insight: CategoryInsight
): VerdictExplanationKey => {
  if (primaryIssue === null) return "level.excellent";
  if (primaryIssue === "echo") {
    return echoImpactKeyForStars(insight.stars);
  }
  return insight.reasonKey ?? insight.descriptionKey;
};

export const echoImpactKeyForStars = (stars: number): VerdictExplanationKey => {
  if (stars >= 4) return "overall.echo.impact_minor";
  if (stars === 3) return "overall.echo.impact_some";
  return "overall.echo.impact_noticeable";
};

export const fixKeyFor = (
  primaryIssue: CategoryId | null,
  descriptionKey: VerdictCategoryDescriptionKey,
  preferredFix?: VerdictFixKey
): VerdictFixKey => {
  if (preferredFix) return preferredFix;
  if (primaryIssue === "level") {
    if (descriptionKey === "level.clipping_detected") return "fix.lower_gain_move_back";
    if (descriptionKey === "level.extremely_quiet") return "fix.increase_gain_move_closer";
    if (descriptionKey === "level.extremely_loud") return "fix.lower_gain_move_back_slight";
    return "fix.nudge_gain";
  }
  if (primaryIssue === "noise") return "fix.reduce_noise_quieter_space";
  if (primaryIssue === "echo") return "fix.light_acoustic_treatment_close_mic";
  return "fix.keep_setup";
};

export const impactFor = (primaryIssue: CategoryId | null): ImpactKey =>
  primaryIssue === "level"
    ? "impact.level"
    : primaryIssue === "noise"
      ? "impact.noise"
      : primaryIssue === "echo"
        ? "impact.echo"
        : "impact.overall";

export const impactSummaryFor = (worstResult: MetricResult): ImpactSummaryKey =>
  worstResult === "pass"
    ? "impact.no_major_issues"
    : worstResult === "warn"
      ? "impact.biggest_opportunity"
      : "impact.mainly_affected";

export const recommendationMessageFor = (
  primaryIssue: CategoryId | null,
  isQuiet: boolean
): RecommendationCopyKey => {
  if (primaryIssue === "level") {
    return isQuiet ? "recommendation.raise_volume" : "recommendation.reduce_clipping";
  }
  if (primaryIssue === "noise") return "recommendation.reduce_noise";
  if (primaryIssue === "echo") return "recommendation.reduce_echo";
  return "recommendation.keep_consistent";
};
