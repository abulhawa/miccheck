import type { CategoryId, MetricsSummary, Verdict, VerdictOverallLabelKey } from "../types";
import { buildVerdictDimensionsFromMetrics } from "./categoryScores";
import { getOverallLabelKeyForGrade, getOverallSummaryKeyForGrade } from "../policy/gradeLabel";
import { computeOverallGrade } from "./overallGrade";


const expectedStarsByLabelKey: Record<VerdictOverallLabelKey, number[]> = {
  "overall.label.excellent": [5],
  "overall.label.good": [4],
  "overall.label.fair": [3],
  "overall.label.needs_improvement": [2],
  "overall.label.unusable": [0, 1]
};

const resolveImpactKey = (primaryIssue: CategoryId | null) =>
  primaryIssue === "level"
    ? "impact.level"
    : primaryIssue === "noise"
      ? "impact.noise"
      : primaryIssue === "echo"
        ? "impact.echo"
        : "impact.overall";

const resolveImpactSummaryKey = (primaryStars: number) => {
  if (primaryStars >= 5) {
    return "impact.no_major_issues";
  }
  if (primaryStars >= 4) {
    return "impact.biggest_opportunity";
  }
  return "impact.mainly_affected";
};

export const assertVerdictInvariant = (verdict: Verdict) => {
  const stars = [
    verdict.dimensions.level.stars,
    verdict.dimensions.noise.stars,
    verdict.dimensions.echo.stars
  ];
  const minStars = Math.min(...stars);

  if (stars.some((value) => !Number.isFinite(value) || value < 0 || value > 5)) {
    throw new Error("Verdict stars must be finite values between 0 and 5.");
  }

  if (verdict.primaryIssue && !verdict.dimensions[verdict.primaryIssue]) {
    throw new Error("Verdict primary issue must map to a dimension.");
  }

  if (verdict.primaryIssue && verdict.dimensions[verdict.primaryIssue].stars >= 5) {
    throw new Error("Verdict primary issue must have fewer than 5 stars.");
  }

  if ((verdict.overall.grade as string) === "Perfect" && verdict.primaryIssue !== null) {
    throw new Error("Perfect grades must not declare a primary issue.");
  }

  if (getOverallLabelKeyForGrade(verdict.overall.grade) !== verdict.overall.labelKey) {
    throw new Error("Verdict overall label must match its grade.");
  }

  const expectedSummaryKey = getOverallSummaryKeyForGrade(verdict.overall.grade);
  if (
    verdict.overall.summaryKey !== expectedSummaryKey &&
    verdict.overall.summaryKey !== "overall.summary.no_speech"
  ) {
    throw new Error("Verdict overall summary must match its grade.");
  }

  if (!expectedStarsByLabelKey[verdict.overall.labelKey].includes(minStars)) {
    throw new Error("Verdict overall label must align with the overall star rating.");
  }
};

export const getVerdict = (metrics: MetricsSummary): Verdict => {
  const dimensions = buildVerdictDimensionsFromMetrics(metrics);
  const { grade, primaryIssueCategory: rawPrimaryIssueCategory, explanationKey, fixKey } =
    computeOverallGrade(metrics);
  const minStars = Math.min(
    dimensions.level.stars,
    dimensions.noise.stars,
    dimensions.echo.stars
  );
  const primaryIssueCategory = minStars === 5 ? null : rawPrimaryIssueCategory;
  const primaryStars = primaryIssueCategory
    ? dimensions[primaryIssueCategory].stars
    : minStars;

  const verdict: Verdict = {
    version: "1.0",
    overall: {
      grade,
      labelKey: getOverallLabelKeyForGrade(grade),
      summaryKey: getOverallSummaryKeyForGrade(grade)
    },
    dimensions,
    primaryIssue: primaryIssueCategory,
    copyKeys: {
      explanationKey,
      fixKey,
      impactKey: resolveImpactKey(primaryIssueCategory),
      impactSummaryKey: resolveImpactSummaryKey(primaryStars)
    }
  };

  assertVerdictInvariant(verdict);
  return verdict;
};

export const getNoSpeechVerdict = (): Verdict => {
  const verdict: Verdict = {
    version: "1.0",
    overall: {
      grade: "F",
      labelKey: "overall.label.unusable",
      summaryKey: "overall.summary.no_speech"
    },
    dimensions: {
      level: { stars: 0, labelKey: "category.level", descriptionKey: "special.no_speech" },
      noise: { stars: 0, labelKey: "category.noise", descriptionKey: "special.no_speech" },
      echo: { stars: 0, labelKey: "category.echo", descriptionKey: "special.no_speech" }
    },
    primaryIssue: null,
    copyKeys: {
      explanationKey: "explanation.no_speech",
      fixKey: "fix.no_speech",
      impactKey: "impact.overall",
      impactSummaryKey: "impact.no_major_issues",
      noSpeechTitleKey: "no_speech.title",
      noSpeechDescriptionKey: "no_speech.description"
    }
  };

  assertVerdictInvariant(verdict);
  return verdict;
};
