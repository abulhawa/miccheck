import type { MetricsSummary } from "../types";

const formatSigned = (value: number): string => value.toFixed(1);

export const formatLevelMetric = (metrics: MetricsSummary): string =>
  `RMS: ${formatSigned(metrics.rmsDb)} dBFS`;

export const formatNoiseMetric = (metrics: MetricsSummary): string =>
  `SNR: ${formatSigned(metrics.snrDb)} dB`;

export const formatEchoMetric = (metrics: MetricsSummary): string =>
  `Echo: ${metrics.echoScore.toFixed(2)} score`;

export const formatClippingMetric = (metrics: MetricsSummary): string =>
  `Clipping: ${(metrics.clippingRatio * 100).toFixed(1)}%`;
