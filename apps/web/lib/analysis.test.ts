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

const sampleSummary = {
  metrics: {
    clippingRatio: 0,
    rmsDb: -18,
    speechRmsDb: -18,
    snrDb: 30,
    humRatio: 0,
    echoScore: 0
  },
  specialState: undefined,
  recommendation: {
    category: "General" as const,
    messageKey: "recommendation.keep_consistent" as const,
    confidence: 0.9
  },
  verdict: {
    version: "1.0" as const,
    overall: {
      grade: "A" as const,
      labelKey: "overall.label.excellent" as const,
      summaryKey: "overall.summary.excellent" as const
    },
    dimensions: {
      level: { stars: 5, labelKey: "category.level" as const, descriptionKey: "level.excellent" as const },
      noise: { stars: 5, labelKey: "category.noise" as const, descriptionKey: "noise.very_clean" as const },
      echo: { stars: 5, labelKey: "category.echo" as const, descriptionKey: "echo.minimal" as const }
    },
    primaryIssue: null,
    copyKeys: {
      explanationKey: "level.excellent" as const,
      fixKey: "fix.keep_setup" as const,
      impactKey: "impact.overall" as const,
      impactSummaryKey: "impact.no_major_issues" as const
    },
    useCaseFit: "pass" as const,
    diagnosticCertainty: "medium" as const,
    reassuranceMode: true,
    bestNextSteps: []
  }
};

describe("analyzeRecording", () => {
  beforeEach(() => {
    computeRmsMock.mockReturnValue(0.1);
    analyzeSamplesMock.mockReset();
  });

  it("returns verdict data from audio-metrics without recomputing UI policy", () => {
    analyzeSamplesMock.mockReturnValue(sampleSummary);

    const result = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(result.verdict.useCaseFit).toBe("pass");
    expect(result.verdict.bestNextSteps).toEqual([]);
  });
});
