import { analyzeSamples, type AnalysisSummary } from "@miccheck/audio-metrics";
import { computeRms } from "@miccheck/audio-core";
import type {
  AnalysisResult,
  ContextInput,
  DiagnosticCertainty,
  UseCaseFit,
  WebVerdict
} from "../types";
import { resolveCopy } from "./copy";
import { SILENT_RECORDING_RMS_THRESHOLD } from "../src/domain/recording/constants";

const toFit = (grade: string): UseCaseFit => {
  if (["A", "A-", "B"].includes(grade)) return "pass";
  if (grade === "C") return "warn";
  return "fail";
};

const toCertainty = (fit: UseCaseFit, context: ContextInput): DiagnosticCertainty => {
  const base: DiagnosticCertainty = fit === "pass" ? "high" : fit === "warn" ? "medium" : "low";
  if (context.device_type === "unknown" && base === "high") return "medium";
  return base;
};

const severityFrom = (verdict: AnalysisSummary["verdict"]): "low" | "medium" | "high" => {
  const minStars = Math.min(
    verdict.dimensions.level.stars,
    verdict.dimensions.noise.stars,
    verdict.dimensions.echo.stars
  );
  if (minStars <= 2) return "high";
  if (minStars === 3) return "medium";
  return "low";
};

const actionStepFor = (verdict: AnalysisSummary["verdict"], context: ContextInput): string => {
  if (verdict.primaryIssue === "level") {
    if (context.device_type === "bluetooth") {
      return "Try speaking louder, keep the headset mic facing your mouth, and keep your head angle stable.";
    }
    if (context.device_type === "built_in") {
      return "Increase system/app mic level and disable audio enhancements or auto-volume.";
    }
  }

  if (verdict.primaryIssue === "noise" && verdict.dimensions.noise.descriptionKey === "noise.electrical_hum") {
    if (context.device_type === "usb_mic") {
      return "Check USB cable seating and grounding; try a different USB port to reduce hum.";
    }
    return "Try unplugging the charger and moving away from power supplies/monitors to isolate interference.";
  }

  return resolveCopy(verdict.copyKeys.fixKey);
};

const hypothesisSteps = (context: ContextInput) => {
  if (context.device_type === "bluetooth") {
    return [
      { kind: "action" as const, title: "Check system mic level and app input level." },
      { kind: "action" as const, title: "Confirm the boom/headset mic is facing your mouth." },
      { kind: "action" as const, title: "Keep your head angle stable while speaking." }
    ];
  }

  return [
    { kind: "action" as const, title: "Check system microphone input level." },
    { kind: "action" as const, title: "Check app input level and disable auto-adjust if enabled." },
    { kind: "action" as const, title: "Re-test after a short speaking sample to confirm improvement." }
  ];
};

const gearStep = (verdict: AnalysisSummary["verdict"], context: ContextInput, fit: UseCaseFit) => {
  const severity = severityFrom(verdict);
  if (context.use_case === "meetings" && !(fit === "fail" && severity === "high")) {
    return undefined;
  }
  if (!verdict.primaryIssue) return undefined;

  const title =
    verdict.primaryIssue === "noise"
      ? "USB dynamic mic (better background rejection for noisy results)"
      : verdict.primaryIssue === "level"
        ? "USB condenser mic with gain control (more consistent input level)"
        : "USB dynamic mic (reduces room pickup and echo reflections)";

  return {
    kind: "gear_optional" as const,
    title,
    affiliateUrl: "https://miccheck.example/recommended-mics"
  };
};

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
  const summary: AnalysisSummary = analyzeSamples(samples, buffer.sampleRate, context);
  const fit = toFit(summary.verdict.overall.grade);
  const certainty = toCertainty(fit, context);

  const reassuranceMode = fit === "pass";
  const actionSteps = certainty === "low"
    ? hypothesisSteps(context)
    : [{ kind: "action" as const, title: actionStepFor(summary.verdict, context) }];
  const optionalGear = gearStep(summary.verdict, context, fit);

  const verdict: WebVerdict = {
    ...summary.verdict,
    context,
    useCaseFit: fit,
    diagnosticCertainty: certainty,
    reassuranceMode,
    bestNextSteps: reassuranceMode ? [] : [...actionSteps, ...(optionalGear ? [optionalGear] : [])]
  };

  return {
    verdict,
    metrics: summary.metrics,
    specialState: summary.specialState
  };
};
