import { computeRms } from "@miccheck/audio-core";

export interface NoiseMetrics {
  noiseFloor: number;
  snrDb: number;
  humRatio: number;
}

const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));

const computePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
  return sorted[index];
};

const goertzel = (samples: Float32Array, sampleRate: number, freq: number): number => {
  const k = Math.round((0.5 + (samples.length * freq) / sampleRate));
  const omega = (2 * Math.PI * k) / samples.length;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (const sample of samples) {
    s0 = sample + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return power / samples.length;
};

/**
 * Estimate noise floor, SNR, and hum ratio.
 */
export const measureNoise = (
  samples: Float32Array,
  sampleRate: number,
  frameMs = 50
): NoiseMetrics => {
  const frameSize = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const frameRms: number[] = [];

  for (let i = 0; i < samples.length; i += frameSize) {
    const slice = samples.subarray(i, i + frameSize);
    frameRms.push(computeRms(slice));
  }

  const noiseFloor = computePercentile(frameRms, 0.2);
  const signalLevel = computePercentile(frameRms, 0.8);
  const snrDb = toDb(signalLevel) - toDb(noiseFloor);

  const hum50 = goertzel(samples, sampleRate, 50);
  const hum60 = goertzel(samples, sampleRate, 60);
  const totalEnergy = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
  const humRatio = totalEnergy > 0 ? Math.max(hum50, hum60) / totalEnergy : 0;

  return { noiseFloor, snrDb, humRatio };
};
