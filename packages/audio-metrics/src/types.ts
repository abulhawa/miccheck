import type { AnalysisSpecialState, Verdict } from "./types/verdict";

export * from "./types/verdict";

export interface MetricsSummary {
  clippingRatio: number;
  /** Guided analysis: fraction of detected speech samples near full scale. */
  speechClippingRatio?: number;
  /** Near-full-scale sample duration across the entire recording, including calibration. */
  clippedDurationSeconds?: number;
  rmsDb: number;
  speechRmsDb: number;
  snrDb: number;
  humRatio: number;
  echoScore: number;
}

export type RecommendationCopyKey =
  | "recommendation.reduce_clipping"
  | "recommendation.reduce_noise"
  | "recommendation.reduce_echo"
  | "recommendation.raise_volume"
  | "recommendation.keep_consistent"
  | "recommendation.no_speech";

export interface Recommendation {
  category: "Clipping" | "Noise" | "Echo" | "Volume" | "General";
  messageKey: RecommendationCopyKey;
  confidence: number;
}

export interface AnalysisSummary {
  verdict: Verdict;
  metrics: MetricsSummary;
  recommendation: Recommendation;
  specialState?: AnalysisSpecialState;
  evidence?: import("./guided").MeasurementEvidence;
}
