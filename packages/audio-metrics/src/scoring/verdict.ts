import type {
  CategoryId,
  GradeLetter,
  MetricsSummary,
  Verdict,
  VerdictDimensions,
  VerdictOverallLabelKey,
  VerdictOverallSummaryKey
} from "../types";
import { describeEcho, describeLevel, describeNoise } from "./categoryScores";
import { computeOverallGrade } from "./overallGrade";

const clampStars = (value: number) => Math.max(0, Math.min(5, value));

const labelKeyByGrade: Record<GradeLetter, VerdictOverallLabelKey> = {
  A: "overall.label.excellent",
  B: "overall.label.good",
  C: "overall.label.fair",
  D: "overall.label.needs_improvement",
  E: "overall.label.needs_improvement",
  F: "overall.label.unusable"
};

const summaryKeyByGrade: Record<GradeLetter, VerdictOverallSummaryKey> = {
  A: "overall.summary.excellent",
  B: "overall.summary.strong",
  C: "overall.summary.fair",
  D: "overall.summary.noticeable",
  E: "overall.summary.noticeable",
  F: "overall.summary.severe"
};

const buildDimensionsFromMetrics = (metrics: MetricsSummary): VerdictDimensions => {
  const levelScore = describeLevel(metrics.rmsDb, metrics.clippingRatio);
  const noiseScore = describeNoise(metrics.snrDb, metrics.humRatio);
  const echoScore = describeEcho(metrics.echoScore);

  return {
    level: {
      stars: clampStars(levelScore.stars),
      labelKey: "category.level",
      descriptionKey: levelScore.descriptionKey
    },
    noise: {
      stars: clampStars(noiseScore.stars),
      labelKey: "category.noise",
      descriptionKey: noiseScore.descriptionKey
    },
    echo: {
      stars: clampStars(echoScore.stars),
      labelKey: "category.echo",
      descriptionKey: echoScore.descriptionKey
    }
  };
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

  if (stars.some((value) => !Number.isFinite(value) || value < 0 || value > 5)) {
    throw new Error("Verdict stars must be finite values between 0 and 5.");
  }

  if (verdict.primaryIssue && !verdict.dimensions[verdict.primaryIssue]) {
    throw new Error("Verdict primary issue must map to a dimension.");
  }
};

export const getVerdict = (metrics: MetricsSummary): Verdict => {
  const dimensions = buildDimensionsFromMetrics(metrics);
  const { grade, primaryIssueCategory, explanationKey, fixKey } =
    computeOverallGrade(metrics);
  const primaryStars = primaryIssueCategory
    ? dimensions[primaryIssueCategory].stars
    : 0;

  const verdict: Verdict = {
    overall: {
      grade,
      labelKey: labelKeyByGrade[grade],
      summaryKey: summaryKeyByGrade[grade]
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
