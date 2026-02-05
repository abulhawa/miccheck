import { analyzeSamples, type AnalysisSummary } from "@miccheck/audio-metrics";
import { computeRms } from "@miccheck/audio-core";
import type {
  AnalysisResult,
  ContextInput,
  DiagnosticCertainty,
  UseCaseFit,
  VerdictTargetMetadata,
  WebVerdict
} from "../types";
import { resolveCopy } from "./copy";
import { SILENT_RECORDING_RMS_THRESHOLD } from "../src/domain/recording/constants";
import { analysisDisplayThresholds } from "./domain/analysisDisplay";

const toFit = (grade: string): UseCaseFit => {
  if (["A", "A-", "B"].includes(grade)) return "pass";
  if (grade === "C") return "warn";
  return "fail";
};

const toCertainty = (fit: UseCaseFit): DiagnosticCertainty =>
  fit === "pass" ? "high" : fit === "warn" ? "medium" : "low";

const toTargetMarker = (value: number, min: number, max: number): VerdictTargetMetadata["marker"] => {
  if (value < min) return "low";
  if (value > max) return "high";
  return "ideal";
};

const buildGearStep = (primaryIssue: WebVerdict["primaryIssue"]) => {
  if (!primaryIssue) return undefined;
  const titles: Record<NonNullable<WebVerdict["primaryIssue"]>, string> = {
    level: "Microphone arm for consistent distance",
    noise: "Directional USB mic to reduce background pickup",
    echo: "Acoustic treatment to damp room reflections"
  };
  return {
    kind: "gear_optional" as const,
    title: titles[primaryIssue],
    affiliateUrl: "https://miccheck.example/recommended-mics"
  };
};

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
export const analyzeRecording = (
  buffer: AudioBuffer,
  context: ContextInput
): AnalysisResult => {
  const samples = mixToMono(buffer);
  const rms = computeRms(samples);
  if (rms < SILENT_RECORDING_RMS_THRESHOLD) {
    throw new Error(resolveCopy("error.silent_recording"));
  }
  const summary: AnalysisSummary = analyzeSamples(samples, buffer.sampleRate, context);
  const fit = toFit(summary.verdict.overall.grade);

  const reassuranceMode = ["A", "A-", "B"].includes(summary.verdict.overall.grade);
  const gearStep = buildGearStep(summary.verdict.primaryIssue);

  const verdict: WebVerdict = {
    ...summary.verdict,
    context,
    useCaseFit: fit,
    diagnosticCertainty: toCertainty(fit),
    reassuranceMode,
    bestNextSteps: reassuranceMode
      ? []
      : [
          {
            kind: "action",
            title: resolveCopy(summary.verdict.copyKeys.fixKey)
          },
          ...(gearStep ? [gearStep] : [])
        ],
    dimensions: {
      ...summary.verdict.dimensions,
      level: {
        ...summary.verdict.dimensions.level,
        target: {
          lowLabel: "Low",
          idealLabel: "Ideal",
          highLabel: "High",
          marker: toTargetMarker(
            summary.metrics.rmsDb,
            analysisDisplayThresholds.levelAcceptableMinDbfs,
            analysisDisplayThresholds.levelAcceptableMaxDbfs
          )
        }
      },
      noise: {
        ...summary.verdict.dimensions.noise,
        target: {
          lowLabel: "Low",
          idealLabel: "Ideal",
          highLabel: "High",
          marker:
            summary.metrics.snrDb < analysisDisplayThresholds.snrCleanThresholdDb
              ? "low"
              : "ideal"
        }
      },
      echo: {
        ...summary.verdict.dimensions.echo,
        target: {
          lowLabel: "Low",
          idealLabel: "Ideal",
          highLabel: "High",
          marker:
            summary.metrics.echoScore > 0.5
              ? "high"
              : summary.metrics.echoScore > 0.2
                ? "ideal"
                : "low"
        }
      }
    }
  };

  return {
    verdict,
    metrics: summary.metrics,
    specialState: summary.specialState
  };
};
