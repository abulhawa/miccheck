import type {
  CategoryId,
  MetricsSummary,
  Recommendation,
  SpecialState,
  Verdict
} from "@miccheck/audio-metrics";

export type { CategoryId, MetricsSummary, Recommendation, SpecialState, Verdict };

export interface AnalysisResult {
  verdict: Verdict;
  metrics: MetricsSummary;
  recommendation: Recommendation;
  specialState?: SpecialState;
}
