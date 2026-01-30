import { computeRms } from "./pcmUtils";

export interface VadFrame {
  isSpeech: boolean;
  rms: number;
}

export interface VadResult {
  frames: VadFrame[];
  speechRatio: number;
  averageSpeechRms: number;
}

/**
 * Simple energy-based voice activity detection.
 */
export const detectVoiceActivity = (
  samples: Float32Array,
  sampleRate: number,
  frameMs = 30,
  thresholdDb = -35
): VadResult => {
  const frameSize = Math.max(1, Math.floor((sampleRate * frameMs) / 1000));
  const frames: VadFrame[] = [];
  const threshold = Math.pow(10, thresholdDb / 20);

  for (let i = 0; i < samples.length; i += frameSize) {
    const slice = samples.subarray(i, i + frameSize);
    const rms = computeRms(slice);
    const isSpeech = rms >= threshold;
    frames.push({ isSpeech, rms });
  }

  const speechFrames = frames.filter((frame) => frame.isSpeech);
  const speechRatio = speechFrames.length / Math.max(1, frames.length);
  const averageSpeechRms =
    speechFrames.reduce((sum, frame) => sum + frame.rms, 0) /
    Math.max(1, speechFrames.length);

  return { frames, speechRatio, averageSpeechRms };
};
