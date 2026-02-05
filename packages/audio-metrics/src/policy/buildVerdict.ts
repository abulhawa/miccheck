import type { CategoryId, ContextInput, GradeLetter, MetricsSummary, Verdict } from "../types";
import { getOverallLabelKeyForGrade, getOverallSummaryKeyForGrade } from "./gradeLabel";
import { evaluateMetrics } from "./evaluateMetrics";
import { describeEcho, describeLevel, describeNoise } from "../scoring/categoryScores";
import { explanationKeyFor, fixKeyFor, impactFor, impactSummaryFor } from "./copy";
import type { MetricResult } from "./evaluateMetrics";

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
    default:
      return "F";
  }
};


export const computeUseCaseFit = (metrics: MetricsSummary, context?: ContextInput) =>
  evaluateMetrics(metrics, context?.use_case ?? "meetings");

export const computeOverallGrade = (minStars: number): GradeLetter => gradeFromStars(minStars);

export const computeReassuranceMode = (minStars: number): boolean => minStars >= 4;

export const computeBestNextSteps = (
  primaryIssue: CategoryId | null,
  descriptions: ReturnType<typeof describeLevel> | ReturnType<typeof describeNoise> | ReturnType<typeof describeEcho>
) => fixKeyFor(primaryIssue, descriptions.descriptionKey, descriptions.fixKey);

export const computeCertainty = (fit: ReturnType<typeof computeUseCaseFit>): "low" | "medium" | "high" =>
  fit.overall.result === "pass" ? "high" : fit.overall.result === "warn" ? "medium" : "low";

export const computeSecondaryNotes = (worstResult: MetricResult) => impactSummaryFor(worstResult);

export const buildVerdict = (metrics: MetricsSummary, context?: ContextInput): Verdict => {
  const fit = computeUseCaseFit(metrics, context);
  const level = describeLevel(metrics.rmsDb, metrics.clippingRatio);
  const noise = describeNoise(metrics.snrDb, metrics.humRatio);
  const echo = describeEcho(metrics.echoScore);

  const minStars = Math.min(level.stars, noise.stars, echo.stars);
  const levelIsMin = level.stars === minStars;
  const noiseIsMin = noise.stars === minStars;
  const echoIsMin = echo.stars === minStars;

  let primaryIssue: CategoryId | null = null;
  let primaryInsight: typeof level | typeof noise | typeof echo = level;

  if (minStars < 5) {
    if (levelIsMin && level.isCatastrophic) {
      primaryIssue = "level";
      primaryInsight = level;
    } else if (echoIsMin) {
      primaryIssue = "echo";
      primaryInsight = echo;
    } else if (noiseIsMin) {
      primaryIssue = "noise";
      primaryInsight = noise;
    } else if (levelIsMin) {
      primaryIssue = "level";
      primaryInsight = level;
    }
  }

  const grade = computeOverallGrade(minStars);
  const reassuranceMode = computeReassuranceMode(minStars);
  const certainty = computeCertainty(fit);

  const verdict: Verdict = {
    version: "1.0",
    overall: {
      grade,
      labelKey: getOverallLabelKeyForGrade(grade),
      summaryKey: reassuranceMode ? getOverallSummaryKeyForGrade(grade) : getOverallSummaryKeyForGrade(grade)
    },
    dimensions: {
      level: {
        stars: level.stars,
        labelKey: "category.level",
        descriptionKey: level.descriptionKey
      },
      noise: {
        stars: noise.stars,
        labelKey: "category.noise",
        descriptionKey: noise.descriptionKey
      },
      echo: {
        stars: echo.stars,
        labelKey: "category.echo",
        descriptionKey: echo.descriptionKey
      }
    },
    primaryIssue,
    copyKeys: {
      explanationKey: explanationKeyFor(primaryIssue, primaryInsight),
      fixKey: computeBestNextSteps(primaryIssue, primaryInsight),
      impactKey: impactFor(primaryIssue),
      impactSummaryKey: computeSecondaryNotes(fit.overall.result)
    },
    context
  };

  void certainty;
  return verdict;
};
