import type {
  AnalysisSpecialState,
  CategoryId,
  ContextInput,
  DeviceType,
  MetricsSummary,
  Recommendation,
  UseCase,
  Verdict
} from "@miccheck/audio-metrics";

export type {
  AnalysisSpecialState,
  CategoryId,
  ContextInput,
  DeviceType,
  MetricsSummary,
  Recommendation,
  UseCase
};

export type UseCaseFit = "pass" | "warn" | "fail";
export type DiagnosticCertainty = "low" | "medium" | "high";

export interface VerdictTargetMetadata {
  marker: "low" | "ideal" | "high";
  lowLabel: string;
  idealLabel: string;
  highLabel: string;
}

export interface VerdictBestNextStep {
  kind: "action" | "gear_optional";
  title: string;
  description?: string;
  affiliateUrl?: string;
}

export type WebVerdict = Verdict & {
  context?: ContextInput;
  useCaseFit?: UseCaseFit;
  diagnosticCertainty?: DiagnosticCertainty;
  reassuranceMode?: boolean;
  bestNextSteps?: VerdictBestNextStep[];
  dimensions: {
    [K in keyof Verdict["dimensions"]]: Verdict["dimensions"][K] & {
      target?: VerdictTargetMetadata;
    };
  };
};

export interface AnalysisResult {
  verdict: WebVerdict;
  metrics: MetricsSummary;
  specialState?: AnalysisSpecialState;
}
