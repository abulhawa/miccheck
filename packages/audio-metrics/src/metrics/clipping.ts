import { computePeak } from "@miccheck/audio-core";
import { ANALYSIS_CONFIG } from "../config";

export interface ClippingMetrics {
  clippingRatio: number;
  nearFullScaleSampleCount: number;
  /** Maximal consecutive runs at or above the threshold; no gap merging. */
  clippingEventCount: number;
  peak: number;
}

/**
 * Count near-full-scale samples as an indicator of possible clipping, not proof
 * of distortion. Each maximal consecutive run is one event, regardless of sign.
 */
export const measureClipping = (
  samples: Float32Array,
  threshold = ANALYSIS_CONFIG.clippingThreshold
): ClippingMetrics => {
  let clipped = 0;
  let clippingEventCount = 0;
  let inEvent = false;
  for (const sample of samples) {
    if (Math.abs(sample) >= threshold) {
      clipped += 1;
      if (!inEvent) clippingEventCount += 1;
      inEvent = true;
    } else {
      inEvent = false;
    }
  }

  return {
    clippingRatio: clipped / Math.max(1, samples.length),
    nearFullScaleSampleCount: clipped,
    clippingEventCount,
    peak: computePeak(samples)
  };
};
