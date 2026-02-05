import type { ContextInput, MetricsSummary, Verdict } from "../types";
import { getOverallLabelKeyForGrade, getOverallSummaryKeyForGrade } from "../policy/gradeLabel";
import { buildVerdict } from "../policy/buildVerdict";

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

  if (verdict.primaryIssue && verdict.dimensions[verdict.primaryIssue].stars >= 5) {
    throw new Error("Verdict primary issue must have fewer than 5 stars.");
  }

  if (getOverallLabelKeyForGrade(verdict.overall.grade) !== verdict.overall.labelKey) {
    throw new Error("Verdict overall label must match its grade.");
  }

  const expectedSummaryKey = getOverallSummaryKeyForGrade(verdict.overall.grade);
  if (
    verdict.overall.summaryKey !== expectedSummaryKey &&
    verdict.overall.summaryKey !== "overall.summary.no_speech" &&
    verdict.overall.summaryKey !== "overall.summary.excellent"
  ) {
    throw new Error("Verdict overall summary must match its grade.");
  }
};

export const getVerdict = (metrics: MetricsSummary, context?: ContextInput): Verdict => {
  const verdict = buildVerdict(metrics, context);
  assertVerdictInvariant(verdict);
  return verdict;
};

export const getNoSpeechVerdict = (context?: ContextInput): Verdict => {
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
    },
    context
  };

  assertVerdictInvariant(verdict);
  return verdict;
};
