import { analyzeSamples, type AnalysisSummary } from "@miccheck/audio-metrics";
import { computeRms } from "@miccheck/audio-core";
import type { AnalysisResult } from "../types";

/**
 * Convert an AudioBuffer to Mono Float32 samples.
 */
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

/**
 * Runs the audio metrics analysis and adapts it to UI-friendly labels.
 */
export const analyzeRecording = (buffer: AudioBuffer): AnalysisResult => {
  const samples = mixToMono(buffer);
  const rms = computeRms(samples);
  if (rms < 0.002) {
    throw new Error("Recording is silent. Please speak closer to the microphone.");
  }
  const summary: AnalysisSummary = analyzeSamples(samples, buffer.sampleRate);

  return {
    grade: summary.grade,
    summary: summary.summary,
    categories: {
      level: summary.categories.level,
      noise: summary.categories.noise,
      echo: summary.categories.echo
    },
    metrics: {
      clippingRatio: summary.metrics.clippingRatio,
      rmsDb: summary.metrics.rmsDb,
      snrDb: summary.metrics.snrDb,
      humRatio: summary.metrics.humRatio,
      echoScore: summary.metrics.echoScore
    },
    primaryIssueCategory: summary.primaryIssueCategory,
    primaryIssueExplanation: summary.primaryIssueExplanation,
    recommendation: summary.recommendation,
    primaryFix: summary.primaryFix,
    specialState: summary.specialState
  };
};
