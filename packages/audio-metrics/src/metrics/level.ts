import { computeRms } from "@miccheck/audio-core";

export interface LevelMetrics {
  rms: number;
  rmsDb: number;
}

const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));

/**
 * Measure RMS level in linear and dBFS values.
 */
export const measureLevel = (samples: Float32Array): LevelMetrics => {
  const rms = computeRms(samples);
  return { rms, rmsDb: toDb(rms) };
};
