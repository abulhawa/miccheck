import type { MetricKey, Severity, UseCase } from "../types";
import { describeEcho, describeLevel, describeNoise } from "../scoring/categoryScores";
import { getThresholdsForUseCase } from "./thresholdMatrix";

export type MetricResult = "pass" | "warn" | "fail";

export interface MetricStatus {
  result: MetricResult;
  severity: Severity;
}

export interface RawMetricsInput {
  rmsDb: number;
  snrDb: number;
  echoScore: number;
  clippingRatio: number;
  humRatio?: number;
}

const toStatus = (result: MetricResult): MetricStatus => ({
  result,
  severity: result === "pass" ? "low" : result === "warn" ? "medium" : "high"
});

const resultFromStars = (stars: number): MetricResult =>
  stars >= 4 ? "pass" : stars >= 2 ? "warn" : "fail";

export const evaluateMetrics = (
  metrics: RawMetricsInput,
  useCase: UseCase = "meetings"
): Record<MetricKey, MetricStatus> => {
  const selected = getThresholdsForUseCase(useCase);

  const level = resultFromStars(describeLevel(metrics.rmsDb, metrics.clippingRatio, useCase).stars);
  const noise = resultFromStars(describeNoise(metrics.snrDb, metrics.humRatio ?? 0, useCase).stars);
  const echo = resultFromStars(describeEcho(metrics.echoScore, useCase).stars);
  const clipping =
    metrics.clippingRatio > selected.clipping.severeRatio
      ? "fail"
      : metrics.clippingRatio > selected.clipping.warningRatio
        ? "warn"
        : "pass";

  const overall: MetricResult = [level, noise, echo, clipping].includes("fail")
    ? "fail"
    : [level, noise, echo, clipping].includes("warn")
      ? "warn"
      : "pass";

  return {
    level: toStatus(level),
    noise: toStatus(noise),
    echo: toStatus(echo),
    clipping: toStatus(clipping),
    overall: toStatus(overall)
  };
};
