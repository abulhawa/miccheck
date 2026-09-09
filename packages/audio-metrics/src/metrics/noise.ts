import { measureHum } from "./hum";
import { detectVoiceActivity } from "@miccheck/audio-core";

export interface NoiseMetrics {
  noiseFloor: number;
  snrDb: number;
  humRatio: number;
  confidence: "low" | "medium" | "high";
}

const computeRms = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
};

const toDb = (value: number): number => 20 * Math.log10(Math.max(value, 1e-8));

const computePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
  return sorted[index];
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

  const humRatio = measureHum(samples, sampleRate);

  const speechFrames: number[] = [];
  const noiseFrames: number[] = [];
  for (let i = 0; i < frameRms.length; i += 1) {
    if (isSpeechFrame[i]) {
      speechFrames.push(frameRms[i]);
    } else {
      noiseFrames.push(frameRms[i]);
    }
  }

  if (noiseFrames.length === 0 && speechFrames.length === 0) {
    const noiseEstimate = computePercentile(frameRms, 0.1);
    noiseFrames.push(noiseEstimate);
  }

  const speechRatio = speechFrames.length / Math.max(1, frameRms.length);
  const confidence =
    speechFrames.length === 0 ? "low" : speechRatio >= 0.3 ? "high" : "medium";

  if (speechFrames.length === 0) {
    const noiseFloor = computePercentile(noiseFrames, 0.2);
    return { noiseFloor, snrDb: 0, humRatio, confidence };
  }

  if (noiseFrames.length === 0) {
    const overallRms = computeRms(samples);
    const gate = overallRms * 0.2;
    let gatedSum = 0;
    let gatedCount = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const value = samples[i];
      if (Math.abs(value) <= gate) {
        gatedSum += value * value;
        gatedCount += 1;
      }
    }
    let noiseFloor = gatedCount > 0 ? Math.sqrt(gatedSum / gatedCount) : 0;
    if (noiseFloor === 0) {
      noiseFloor = computePercentile(frameRms, 0.1);
    }
    const snrDb = toDb(overallRms) - toDb(noiseFloor);
    return { noiseFloor, snrDb, humRatio, confidence: "medium" };
  }

  const noiseFloor = computePercentile(noiseFrames, 0.2);
  const speechLevel = computePercentile(speechFrames, 0.5);
  const snrDb = toDb(speechLevel) - toDb(noiseFloor);

  return { noiseFloor, snrDb, humRatio, confidence };
};
