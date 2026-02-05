import type {
  AnalysisSpecialState,
  CategoryId,
  MetricsSummary,
  Recommendation,
  Verdict
} from "@miccheck/audio-metrics";

export type { AnalysisSpecialState, CategoryId, MetricsSummary, Recommendation, Verdict };

export interface AnalysisResult {
  verdict: Verdict;
  metrics: MetricsSummary;
  recommendation: Recommendation;
  specialState?: AnalysisSpecialState;
}
