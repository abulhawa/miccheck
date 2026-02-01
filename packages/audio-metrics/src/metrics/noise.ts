import { detectVoiceActivity } from "@miccheck/audio-core";

export interface NoiseMetrics {
  noiseFloor: number;
  snrDb: number;
  humRatio: number;
  confidence: "low" | "medium" | "high";
}

const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));

const computePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
  return sorted[index];
};

const goertzel = (samples: Float32Array, sampleRate: number, freq: number): number => {
  if (samples.length === 0) return 0;
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
  if (samples.length === 0) {
    return { noiseFloor: 0, snrDb: 0, humRatio: 0, confidence: "low" };
  }
  const vadResult = detectVoiceActivity(samples, sampleRate, frameMs);
  const frameRms = vadResult.frameRms ?? vadResult.frames.map((frame) => frame.rms);
  const isSpeechFrame =
    vadResult.isSpeechFrame ?? vadResult.frames.map((frame) => frame.isSpeech);

  if (frameRms.length === 0) {
    return { noiseFloor: 0, snrDb: 0, humRatio: 0, confidence: "low" };
  }

  const hum50 = goertzel(samples, sampleRate, 50);
  const hum60 = goertzel(samples, sampleRate, 60);
  const totalEnergy = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
  const humRatio = totalEnergy > 0 ? Math.max(hum50, hum60) / totalEnergy : 0;

  const speechFrames: number[] = [];
  const noiseFrames: number[] = [];
  for (let i = 0; i < frameRms.length; i += 1) {
    if (isSpeechFrame[i]) {
      speechFrames.push(frameRms[i]);
    } else {
      noiseFrames.push(frameRms[i]);
    }
  }

  if (noiseFrames.length === 0) {
    const noiseEstimate = computePercentile(frameRms, 0.1);
    noiseFrames.push(noiseEstimate);
  }

  const speechRatio = speechFrames.length / Math.max(1, frameRms.length);
  const confidence =
    speechFrames.length === 0 ? "low" : speechRatio >= 0.3 ? "high" : "medium";

  if (speechFrames.length === 0) {
    const noiseFloor = computePercentile(noiseFrames, 0.5);
    return { noiseFloor, snrDb: 0, humRatio, confidence };
  }

  const noiseFloor = computePercentile(noiseFrames, 0.5);
  const speechLevel = computePercentile(speechFrames, 0.5);
  const snrDb = toDb(speechLevel) - toDb(noiseFloor);

  return { noiseFloor, snrDb, humRatio, confidence };
};
