import { computePeak } from "@miccheck/audio-core";
import { ANALYSIS_CONFIG } from "../config";

export interface ClippingMetrics {
  clippingRatio: number;
  peak: number;
}

/**
 * Detect clipped samples exceeding the threshold.
 */
export const measureClipping = (
  samples: Float32Array,
  threshold = ANALYSIS_CONFIG.clippingThreshold
): ClippingMetrics => {
  let clipped = 0;
  for (const sample of samples) {
    if (Math.abs(sample) >= threshold) {
      clipped += 1;
    }
  }

  return {
    clippingRatio: clipped / Math.max(1, samples.length),
    peak: computePeak(samples)
  };
};
