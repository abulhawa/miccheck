import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeSamplesMock, computeRmsMock } = vi.hoisted(() => ({
  analyzeSamplesMock: vi.fn(),
  computeRmsMock: vi.fn()
}));

vi.mock("@miccheck/audio-metrics", () => ({
  analyzeSamples: analyzeSamplesMock
}));

vi.mock("@miccheck/audio-core", () => ({
  computeRms: computeRmsMock
}));

import { analyzeRecording } from "./analysis";

const makeBuffer = (): AudioBuffer =>
  ({
    numberOfChannels: 1,
    length: 4,
    sampleRate: 48_000,
    getChannelData: () => new Float32Array([0.1, 0.1, 0.1, 0.1])
  }) as unknown as AudioBuffer;

const makeSummary = (grade: "A" | "F") => ({
  metrics: {
    clippingRatio: 0,
    rmsDb: -18,
    speechRmsDb: -18,
    snrDb: 30,
    humRatio: 0,
    echoScore: 0
  },
  specialState: undefined,
  verdict: {
    version: "1.0",
    overall: {
      grade,
      labelKey: grade === "A" ? "overall.label.excellent" : "overall.label.unusable",
      summaryKey: grade === "A" ? "overall.summary.excellent" : "overall.summary.severe"
    },
    dimensions: {
      level: { stars: grade === "A" ? 5 : 1, labelKey: "category.level", descriptionKey: "level.excellent" },
      noise: { stars: grade === "A" ? 5 : 1, labelKey: "category.noise", descriptionKey: "noise.very_noisy" },
      echo: { stars: grade === "A" ? 5 : 1, labelKey: "category.echo", descriptionKey: "echo.overwhelming" }
    },
    primaryIssue: grade === "A" ? null : "noise",
    copyKeys: {
      explanationKey: "explanation.strong_echo",
      fixKey: "fix.add_soft_furnishings_move_closer",
      impactKey: "impact.echo",
      impactSummaryKey: "impact.mainly_affected"
    }
  }
});

describe("analyzeRecording verdict extensions", () => {
  beforeEach(() => {
    computeRmsMock.mockReturnValue(0.1);
    analyzeSamplesMock.mockReset();
  });

  it("enforces pass => reassurance mode true and best next steps empty", () => {
    analyzeSamplesMock.mockReturnValue(makeSummary("A"));

    const result = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(result.verdict.useCaseFit).toBe("pass");
    expect(result.verdict.reassuranceMode).toBe(true);
    expect(result.verdict.bestNextSteps).toEqual([]);
  });

  it("caps diagnostic certainty for unknown device type", () => {
    analyzeSamplesMock.mockReturnValue(makeSummary("A"));

    const result = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(result.verdict.diagnosticCertainty).not.toBe("high");
    expect(result.verdict.diagnosticCertainty).toBe("medium");
  });

  it("uses low-certainty hypothesis checks for low certainty verdicts", () => {
    analyzeSamplesMock.mockReturnValue(makeSummary("F"));

    const result = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(result.verdict.diagnosticCertainty).toBe("low");
    expect(result.verdict.bestNextSteps?.length).toBeGreaterThanOrEqual(2);
  });
});
