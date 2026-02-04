// @vitest-environment jsdom
import React, { useEffect } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";

vi.mock("@miccheck/audio-core", () => ({
  describeBrowserSupport: () => ({ isSupported: true, issues: [] })
}));

vi.mock("../lib/analysis", () => ({
  analyzeRecording: () => ({
    verdict: {
      overall: {
        grade: "A",
        labelKey: "overall.label.excellent",
        summaryKey: "overall.summary.excellent"
      },
      dimensions: {
        level: { stars: 4, labelKey: "category.level", descriptionKey: "level.slightly_off_target" },
        noise: { stars: 4, labelKey: "category.noise", descriptionKey: "noise.clean_background" },
        echo: { stars: 4, labelKey: "category.echo", descriptionKey: "echo.slight_reflections" }
      },
      primaryIssue: "level",
      copyKeys: {
        explanationKey: "explanation.noticeably_off_target",
        fixKey: "fix.nudge_gain",
        impactKey: "impact.level",
        impactSummaryKey: "impact.biggest_opportunity"
      }
    },
    metrics: {
      clippingRatio: 0,
      rmsDb: -20,
      speechRmsDb: -18,
      snrDb: 20,
      humRatio: 0,
      echoScore: 0.1
    },
    recommendation: { category: "General", message: "Keep it up.", confidence: 0.9 },
    specialState: undefined
  })
}));

type RecorderHook = ReturnType<typeof useAudioRecorder>;

const HookHarness = ({ onReady }: { onReady: (value: RecorderHook) => void }) => {
  const recorder = useAudioRecorder({});
  useEffect(() => {
    onReady(recorder);
  }, [onReady, recorder]);
  return null;
};

describe("useAudioRecorder", () => {
  const originalAudioContext = window.AudioContext;
  const originalWebkitAudioContext = (window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
  }).webkitAudioContext;
  const originalMediaDevices = navigator.mediaDevices;
  const originalMediaRecorder = window.MediaRecorder;
  const originalRequestAnimationFrame = window.requestAnimationFrame;

  beforeEach(() => {
    delete (window as Partial<typeof window>).AudioContext;
    delete (window as Partial<typeof window> & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  });

  afterEach(() => {
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    } else {
      delete (window as Partial<typeof window>).AudioContext;
    }
    if (originalWebkitAudioContext) {
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext =
        originalWebkitAudioContext;
    } else {
      delete (window as Partial<typeof window> & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    }
    if (originalMediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: originalMediaDevices,
        configurable: true
      });
    } else {
      delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    }
    if (originalMediaRecorder) {
      window.MediaRecorder = originalMediaRecorder;
    } else {
      delete (window as Partial<typeof window>).MediaRecorder;
    }
    if (originalRequestAnimationFrame) {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (window as Partial<typeof window>).requestAnimationFrame;
    }
  });

  it("stops tracks when AudioContext is unavailable after getUserMedia", async () => {
    const stopTrack = vi.fn();
    const stream = {
      getTracks: vi.fn(() => [{ stop: stopTrack }])
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true
    });

    const container = document.createElement("div");
    const root = createRoot(container);
    let recorder: RecorderHook | undefined;

    await act(async () => {
      root.render(<HookHarness onReady={(value) => (recorder = value)} />);
    });

    await act(async () => {
      await recorder?.initializeRecorder();
    });

    expect(getUserMedia).toHaveBeenCalled();
    expect(stream.getTracks).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    root.unmount();
  });

  it("includes the configured minDuration in the short recording message", async () => {
    window.requestAnimationFrame = vi.fn();

    const stopTrack = vi.fn();
    const stream = {
      getTracks: vi.fn(() => [{ stop: stopTrack }])
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true
    });

    class MockAudioContext {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          getFloatTimeDomainData: vi.fn()
        };
      }
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 2 });
      close = vi.fn().mockResolvedValue(undefined);
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    class MockMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true);
      state = "inactive";
      mimeType = "audio/webm";
      stream: MediaStream;
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(stream: MediaStream) {
        this.stream = stream;
      }

      start = vi.fn(() => {
        this.state = "recording";
      });

      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });
    }

    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    const container = document.createElement("div");
    const root = createRoot(container);
    let recorder: RecorderHook | undefined;

    const HookHarnessWithOptions = ({
      onReady
    }: {
      onReady: (value: RecorderHook) => void;
    }) => {
      const recorder = useAudioRecorder({ minDuration: 3 });
      useEffect(() => {
        onReady(recorder);
      }, [onReady, recorder]);
      return null;
    };

    await act(async () => {
      root.render(<HookHarnessWithOptions onReady={(value) => (recorder = value)} />);
    });

    await act(async () => {
      await recorder?.startRecording();
    });

    await act(async () => {
      recorder?.stopRecording();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(recorder?.error).toBe("Recording was too short. Please capture at least 3 seconds.");
    root.unmount();
  });

  it("stops microphone tracks once recording is complete", async () => {
    window.requestAnimationFrame = vi.fn();

    const stopTrack = vi.fn();
    const stream = {
      getTracks: vi.fn(() => [{ stop: stopTrack }])
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true
    });

    class MockAudioContext {
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          getFloatTimeDomainData: vi.fn()
        };
      }
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 6 });
      close = vi.fn().mockResolvedValue(undefined);
    }

    window.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    class MockMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true);
      state = "inactive";
      mimeType = "audio/webm";
      stream: MediaStream;
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(stream: MediaStream) {
        this.stream = stream;
      }

      start = vi.fn(() => {
        this.state = "recording";
      });

      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });
    }

    window.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

    const container = document.createElement("div");
    const root = createRoot(container);
    let recorder: RecorderHook | undefined;

    await act(async () => {
      root.render(<HookHarness onReady={(value) => (recorder = value)} />);
    });

    await act(async () => {
      await recorder?.startRecording();
    });

    await act(async () => {
      recorder?.stopRecording();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(stopTrack).toHaveBeenCalled();
    root.unmount();
  });
});
