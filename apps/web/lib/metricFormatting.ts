import type { MetricsSummary } from "../types";

const formatSigned = (value: number): string => value.toFixed(1);

export const formatLevelMetric = (metrics: MetricsSummary): string =>
  `RMS: ${formatSigned(metrics.rmsDb)} dBFS`;

export const formatNoiseMetric = (metrics: MetricsSummary): string =>
  `SNR: ${formatSigned(metrics.snrDb)} dB`;

export const formatEchoMetric = (metrics: MetricsSummary): string =>
  `Echo: ${metrics.echoScore.toFixed(2)} score`;

export const formatClippingMetric = (metrics: MetricsSummary): string =>
  metrics.speechClippingRatio !== undefined
    ? `Clipping in detected speech: ${(metrics.speechClippingRatio * 100).toFixed(1)}%`
    : `Clipping: ${(metrics.clippingRatio * 100).toFixed(1)}%`;

export const formatClippingSelectionWarning = (metrics: MetricsSummary): string | null => {
  const duration = metrics.unselectedClippedDurationSeconds ?? 0;
  if (duration <= 0) return null;
  const amount = duration < 0.001 ? 'Less than 0.001 seconds' : duration.toFixed(3) + ' seconds';
  return amount + ' of near-full-scale samples occur outside detected speech after calibration. Speech clipping may be underestimated. Listen to the recording to check for distortion.';
};
