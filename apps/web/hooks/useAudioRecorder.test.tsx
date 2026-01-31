// @vitest-environment jsdom
import React, { useEffect } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";

vi.mock("@miccheck/audio-core", () => ({
  describeBrowserSupport: () => ({ isSupported: true, issues: [] })
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
});
