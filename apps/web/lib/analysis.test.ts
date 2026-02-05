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

const makeSummary = (echoScore: number) => ({
  metrics: {
    clippingRatio: 0,
    rmsDb: -18,
    speechRmsDb: -18,
    snrDb: 30,
    humRatio: 0,
    echoScore
  },
  specialState: undefined,
  verdict: {
    version: "1.0",
    overall: {
      grade: "A",
      labelKey: "overall.label.excellent",
      summaryKey: "overall.summary.excellent"
    },
    dimensions: {
      level: { stars: 5, labelKey: "category.level", descriptionKey: "level.excellent" },
      noise: { stars: 5, labelKey: "category.noise", descriptionKey: "noise.very_clean" },
      echo: { stars: 5, labelKey: "category.echo", descriptionKey: "echo.minimal" }
    },
    primaryIssue: "echo",
    copyKeys: {
      explanationKey: "explanation.strong_echo",
      fixKey: "fix.add_soft_furnishings_move_closer",
      impactKey: "impact.echo",
      impactSummaryKey: "impact.mainly_affected"
    }
  }
});

describe("analyzeRecording echo target marker", () => {
  beforeEach(() => {
    computeRmsMock.mockReturnValue(0.1);
    analyzeSamplesMock.mockReset();
  });

  it("marks minimal echo as ideal", () => {
    analyzeSamplesMock.mockReturnValue(makeSummary(0.2));

    const result = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(result.verdict.dimensions.echo.target?.marker).toBe("ideal");
  });

  it("marks mid echo as low and high echo as high", () => {
    analyzeSamplesMock.mockReturnValueOnce(makeSummary(0.3)).mockReturnValueOnce(makeSummary(0.7));

    const midResult = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });
    const highResult = analyzeRecording(makeBuffer(), {
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });

    expect(midResult.verdict.dimensions.echo.target?.marker).toBe("low");
    expect(highResult.verdict.dimensions.echo.target?.marker).toBe("high");
  });
});
