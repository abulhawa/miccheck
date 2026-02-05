import type { GradeLetter, VerdictOverallLabelKey, VerdictOverallSummaryKey } from "../types";

const gradeLabelMap: Record<GradeLetter, VerdictOverallLabelKey> = {
  A: "overall.label.excellent",
  "A-": "overall.label.good",
  B: "overall.label.good",
  C: "overall.label.fair",
  D: "overall.label.needs_improvement",
  F: "overall.label.unusable"
};

const gradeSummaryMap: Record<GradeLetter, VerdictOverallSummaryKey> = {
  A: "overall.summary.excellent",
  "A-": "overall.summary.strong",
  B: "overall.summary.strong",
  C: "overall.summary.fair",
  D: "overall.summary.noticeable",
  F: "overall.summary.severe"
};

export const getOverallLabelKeyForGrade = (
  grade: GradeLetter
): VerdictOverallLabelKey => gradeLabelMap[grade];

export const getOverallSummaryKeyForGrade = (
  grade: GradeLetter
): VerdictOverallSummaryKey => gradeSummaryMap[grade];
