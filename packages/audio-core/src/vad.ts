import { computeRms } from "./pcmUtils";

export interface VadFrame {
  isSpeech: boolean;
  rms: number;
}

export interface VadResult {
  frames: VadFrame[];
  speechRatio: number;
  averageSpeechRms: number;
  frameRms: number[];
  isSpeechFrame: boolean[];
  frameSize: number;
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
  const frameRms: number[] = [];
  const isSpeechFrame: boolean[] = [];
  const threshold = Math.pow(10, thresholdDb / 20);
  let speechFrames = 0;
  let speechRmsSum = 0;

  for (let i = 0; i < samples.length; i += frameSize) {
    const slice = samples.subarray(i, i + frameSize);
    const rms = computeRms(slice);
    const isSpeech = rms >= threshold;
    frames.push({ isSpeech, rms });
    frameRms.push(rms);
    isSpeechFrame.push(isSpeech);
    if (isSpeech) {
      speechFrames += 1;
      speechRmsSum += rms;
    }
  }

  const speechRatio = speechFrames / Math.max(1, frames.length);
  const averageSpeechRms = speechFrames > 0 ? speechRmsSum / speechFrames : 0;

  return {
    frames,
    speechRatio,
    averageSpeechRms,
    frameRms,
    isSpeechFrame,
    frameSize
  };
};
