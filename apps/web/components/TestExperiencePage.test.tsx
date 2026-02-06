import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AnalysisResult } from "../types";
import TestExperiencePage from "./TestExperiencePage";

const mockUseAudioRecorder = vi.fn();
const mockUseAudioMeter = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("../hooks/useAudioRecorder", () => ({
  useAudioRecorder: (...args: unknown[]) => mockUseAudioRecorder(...args)
}));

vi.mock("../hooks/useAudioMeter", () => ({
  useAudioMeter: (...args: unknown[]) => mockUseAudioMeter(...args)
}));

vi.mock("./AudioPlayer", () => ({
  default: () => null
}));

vi.mock("./AudioWaveformVisualizer", () => ({
  default: () => null
}));

vi.mock("./DeviceSelector", () => ({
  default: () => null
}));

vi.mock("./ResultsNotice", () => ({
  default: () => null
}));

vi.mock("./BestNextSteps", () => ({
  default: () => <div>BestNextSteps</div>
}));

const baseAnalysis: AnalysisResult = {
  verdict: {
    version: "1.0",
    overall: {
      grade: "A",
      labelKey: "overall.label.excellent",
      summaryKey: "overall.summary.excellent"
    },
    dimensions: {
      level: {
        stars: 5,
        labelKey: "category.level",
        descriptionKey: "level.excellent"
      },
      noise: {
        stars: 5,
        labelKey: "category.noise",
        descriptionKey: "noise.very_clean"
      },
      echo: {
        stars: 5,
        labelKey: "category.echo",
        descriptionKey: "echo.minimal"
      }
    },
    primaryIssue: null,
    useCaseFit: "pass",
    diagnosticCertainty: "high",
    reassuranceMode: false,
    bestNextSteps: [],
    copyKeys: {
      explanationKey: "overall.label.excellent",
      fixKey: "fix.keep_setup",
      impactKey: "impact.no_major_issues",
      impactSummaryKey: "impact.biggest_opportunity"
    }
  },
  metrics: {
    clippingRatio: 0.002,
    rmsDb: -20,
    speechRmsDb: -19,
    snrDb: 20,
    humRatio: 0,
    echoScore: 0.1
  }
};

describe("TestExperiencePage", () => {
  beforeEach(() => {
    mockUseAudioMeter.mockReturnValue({
      audioDataArray: new Float32Array(),
      currentVolume: 0,
      peakVolume: 0
    });
  });

  it("shows the excellent reassurance card instead of best next steps", () => {
    mockUseAudioRecorder.mockReturnValue({
      status: "complete",
      error: null,
      duration: 0,
      mediaStream: null,
      recordingBlob: null,
      analysis: baseAnalysis,
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      reset: vi.fn()
    });

    const html = renderToStaticMarkup(<TestExperiencePage viewMode="pro" />);

    expect(html).toContain("✅ You’re good to go");
    expect(html).toContain("Want to save it? Share your result.");
    expect(html).not.toContain("BestNextSteps");
  });

  it("keeps best next steps for non-Excellent grades", () => {
    mockUseAudioRecorder.mockReturnValue({
      status: "complete",
      error: null,
      duration: 0,
      mediaStream: null,
      recordingBlob: null,
      analysis: {
        ...baseAnalysis,
        verdict: {
          ...baseAnalysis.verdict,
          overall: {
            grade: "B",
            labelKey: "overall.label.good",
            summaryKey: "overall.summary.strong"
          },
          copyKeys: {
            ...baseAnalysis.verdict.copyKeys,
            explanationKey: "overall.echo.impact_some"
          },
          bestNextSteps: [{ kind: "action", title: "recommendation.reduce_echo", titleKey: "recommendation.reduce_echo" }]
        }
      },
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      reset: vi.fn()
    });

    const html = renderToStaticMarkup(<TestExperiencePage viewMode="pro" />);

    expect(html).toContain("BestNextSteps");
    expect(html).not.toContain("✅ You’re good to go");
  });
});
