import { describe, expect, it } from "vitest";
import { analyzeGuidedSamples } from "@miccheck/audio-metrics";
const rate = 16000;
const context = {
  use_case: "meetings" as const,
  device_type: "unknown" as const,
  mode: "basic" as const,
};
const evidence = {
  quietSeconds: 2,
  speechDetection: "silero" as const,
  segments: [{ start: 3, end: 5 }],
  capture: {
    format: "pcm" as const,
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
};
const fixture = () =>
  Float32Array.from(
    { length: 8 * rate },
    (_, i) =>
      0.001 * Math.sin((2 * Math.PI * 3000 * i) / rate) +
      (i >= 3 * rate && i < 5 * rate
        ? 0.1 * Math.sin((2 * Math.PI * 300 * i) / rate)
        : 0),
  );
describe("unselected clipping evidence", () => {
  it("limits certainty for crossings omitted by speech selection without inventing speech clipping or gain advice", () => {
    const samples = fixture();
    const before = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(before.verdict.diagnosticCertainty).toBe("medium");
    samples.fill(0.99, Math.round(2.8 * rate), Math.round(2.82 * rate));
    const after = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(after.metrics.unselectedClippedDurationSeconds).toBe(0.02);
    expect(after.metrics.speechClippingRatio).toBe(0);
    expect(after.verdict.diagnosticCertainty).toBe("low");
    expect(after.verdict.overall.grade).toBe(before.verdict.overall.grade);
    expect(after.recommendation).toEqual(before.recommendation);
    expect(after.evidence?.retryReason).toBeUndefined();
  });
  it("attributes only the post-calibration, unselected part of a boundary-spanning crossing", () => {
    const samples = fixture();
    samples.fill(-0.99, Math.round(1.99 * rate), Math.round(2.01 * rate));
    samples.fill(0.99, Math.round(2.99 * rate), Math.round(3.01 * rate));
    const result = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(result.metrics.clippedDurationSeconds).toBe(0.04);
    expect(result.metrics.unselectedClippedDurationSeconds).toBe(0.02);
    expect(result.metrics.speechClippingRatio).toBe(0.01 / 2);
  });
  it("does not count calibration or selected speech twice when selections overlap", () => {
    const samples = fixture();
    samples.fill(0.99, Math.round(0.5 * rate), Math.round(0.52 * rate));
    samples.fill(-0.99, Math.round(3.5 * rate), Math.round(3.52 * rate));
    const result = analyzeGuidedSamples(samples, rate, context, {
      ...evidence,
      segments: [
        { start: 0, end: 5 },
        { start: 3, end: 5 },
      ],
    });
    expect(result.metrics.unselectedClippedDurationSeconds).toBe(0);
    expect(result.metrics.clippedDurationSeconds).toBe(0.04);
  });
  it("retains the unclassified crossing without speech and across added pauses", () => {
    const samples = fixture();
    samples.fill(0.99, Math.round(2.8 * rate), Math.round(2.82 * rate));
    const extended = new Float32Array(samples.length + rate * 3);
    extended.set(samples);
    for (const pcm of [samples, extended]) {
      expect(
        analyzeGuidedSamples(pcm, rate, context, evidence).metrics
          .unselectedClippedDurationSeconds,
      ).toBe(0.02);
      const noSpeech = analyzeGuidedSamples(pcm, rate, context, {
        ...evidence,
        segments: [],
      });
      expect(noSpeech.specialState).toBe("NO_SPEECH");
      expect(noSpeech.metrics.unselectedClippedDurationSeconds).toBe(0.02);
      expect(noSpeech.metrics.speechClippingRatio).toBe(0);
    }
  });
});
