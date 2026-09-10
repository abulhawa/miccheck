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

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams()
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
      impactKey: "impact.overall",
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
  it.each([
    ['idle', 'Measure my room'],
    ['calibrating', 'Measuring room…'],
    ['ready', 'Start voice recording'],
    ['recording', 'Finish recording'],
  ])('shows the explicit %s step and a recognizable reading passage', (status, button) => {
    mockUseAudioRecorder.mockReturnValue({status,duration:10,analysis:null,startCalibration:vi.fn(),startRecording:vi.fn(),stopRecording:vi.fn(),reset:vi.fn()});
    const html = renderToStaticMarkup(<TestExperiencePage viewMode="basic" />);
    expect(html).toContain('1. Measure your room');
    expect(html).toContain('2. Record your voice');
    expect(html).toContain('Read this aloud in step 2');
    expect(html).toContain('Hello, this is a check of my microphone.');
    expect(html).toContain(button);
    expect(html).toContain('up to 20 seconds');
    if (status === 'ready') expect(html).toContain('nothing is being recorded while you prepare');
  });
  it.each([
    ['calibration_speech', 'Speech detected during room calibration'],
    ['speech_too_short', 'Speech detected, but the sample is too short'],
    ['speech_detection_unavailable', 'Could not verify speech reliably'],
    ['calibration_too_short', 'Room calibration was too short'],
    [undefined, 'Not enough evidence for a grade'],
  ] as const)("explains %s without claiming no speech", (retryReason, title) => {
    mockUseAudioRecorder.mockReturnValue({
      status: 'complete', duration: 7,
      analysis: {...baseAnalysis, specialState:'INSUFFICIENT_EVIDENCE', evidence:{
        speechSeconds:3, quietSeconds:2, speechDetection:'silero', capture:{format:'pcm'},
        noiseReliable:false, echoExperimental:true, retryReason,
      }},
      startRecording:vi.fn(), stopRecording:vi.fn(), reset:vi.fn(),
    });
    const html = renderToStaticMarkup(<TestExperiencePage viewMode="pro" />);
    expect(html).toContain(title);
    expect(html).not.toContain('No speech detected');
    expect(html).not.toContain('You are good to go');
  });
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

    expect(html).toContain("You are good to go");
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
          bestNextSteps: [
            { kind: "action", title: "recommendation.reduce_echo", titleKey: "recommendation.reduce_echo" }
          ]
        }
      },
      startRecording: vi.fn(),
      stopRecording: vi.fn(),
      reset: vi.fn()
    });

    const html = renderToStaticMarkup(<TestExperiencePage viewMode="pro" />);

    expect(html).toContain("Run Another Test");
    expect(html).toContain("BestNextSteps");
    expect(html.indexOf("Run Another Test")).toBeLessThan(html.indexOf("BestNextSteps"));
    expect(html).not.toContain("You are good to go");
  });
});
