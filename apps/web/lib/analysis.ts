import { analyzeSamples } from "@miccheck/audio-metrics";
import { computeRms } from "@miccheck/audio-core";
import type { AnalysisResult, ContextInput } from "../types";
import { resolveCopy } from "./copy";
import { SILENT_RECORDING_RMS_THRESHOLD } from "../src/domain/recording/constants";

const mixToMono = (buffer: AudioBuffer): Float32Array => {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const channelData = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index)
  );
  const length = buffer.length;
  const mixed = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channelData) {
      sum += channel[i];
    }
    mixed[i] = sum / channelData.length;
  }
  return mixed;
};

export const analyzeRecording = (
  buffer: AudioBuffer,
  context: ContextInput
): AnalysisResult => {
  const samples = mixToMono(buffer);
  const rms = computeRms(samples);
  if (rms < SILENT_RECORDING_RMS_THRESHOLD) {
    throw new Error(resolveCopy("error.silent_recording"));
  }

  return analyzeSamples(samples, buffer.sampleRate, context);
};
