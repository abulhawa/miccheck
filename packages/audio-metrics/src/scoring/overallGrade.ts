import type {
  CategoryId,
  GradeLetter,
  MetricsSummary,
  VerdictExplanationKey,
  VerdictFixKey
} from "../types";
import { buildVerdict } from "../policy/buildVerdict";

/**
 * @deprecated Prefer policy/buildVerdict.ts for full verdict composition.
 */
export const computeOverallGrade = (
  metrics: MetricsSummary
): {
  grade: GradeLetter;
  primaryIssueCategory: CategoryId;
  explanationKey: VerdictExplanationKey;
  fixKey: VerdictFixKey;
} => {
  const verdict = buildVerdict(metrics);

  return {
    grade: verdict.overall.grade,
    primaryIssueCategory: verdict.primaryIssue ?? "level",
    explanationKey: verdict.copyKeys.explanationKey,
    fixKey: verdict.copyKeys.fixKey
  };
};
