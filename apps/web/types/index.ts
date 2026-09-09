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
  evidence?: import('@miccheck/audio-metrics').MeasurementEvidence;
  ai?: {
    segments: import('@miccheck/audio-metrics').SpeechSegment[];
    background: import('../lib/ai/sounds').SoundHint | null;
    noiseStatus: 'off' | 'ready' | 'unavailable';
    engine: string;
    elapsedMs: number;
  };
}
