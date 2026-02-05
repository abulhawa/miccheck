import type {
  AnalysisSpecialState,
  ContextInput,
  DeviceType,
  DiagnosticCertainty,
  MetricsSummary,
  Recommendation,
  UseCase,
  UseCaseFit,
  Verdict,
  VerdictBestNextStep
} from "@miccheck/audio-metrics";

export type {
  AnalysisSpecialState,
  ContextInput,
  DeviceType,
  DiagnosticCertainty,
  MetricsSummary,
  Recommendation,
  UseCase,
  UseCaseFit,
  VerdictBestNextStep
};

export type WebVerdict = Verdict;

export interface VerdictTargetMetadata {
  lowLabel: string;
  idealLabel: string;
  highLabel: string;
  marker: "low" | "ideal" | "high";
}

export interface AnalysisResult {
  verdict: WebVerdict;
  metrics: MetricsSummary;
  specialState?: AnalysisSpecialState;
}
