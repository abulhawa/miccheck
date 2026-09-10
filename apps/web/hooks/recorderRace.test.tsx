// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useAudioRecorder } from "./useAudioRecorder";
import { clearSession } from "../lib/recordingSession";

vi.mock("@miccheck/audio-core", () => ({
  describeBrowserSupport: () => ({ isSupported: true, issues: [] }),
}));
vi.mock("../lib/pcmCapture", () => ({ createPcmCapture: async () => null }));
vi.mock("../lib/localAnalysis", () => ({ analyzeLocally: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearSession();
});

it("does not attach an old recorder when AudioContext.resume finishes after reset", async () => {
  let resumeOld!: () => void;
  const oldResume = new Promise<void>((resolve) => {
    resumeOld = resolve;
  });
  const resume = vi
    .fn()
    .mockReturnValueOnce(oldResume)
    .mockResolvedValue(undefined);
  const tracks: { stop: ReturnType<typeof vi.fn>; readyState: string }[] = [];
  const getUserMedia = vi.fn(async () => {
    const track = { stop: vi.fn(), readyState: "live" };
    tracks.push(track);
    track.stop.mockImplementation(() => {
      track.readyState = "ended";
    });
    return { getTracks: () => [track] };
  });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    "AudioContext",
    class {
      resume = resume;
      close = vi.fn().mockResolvedValue(undefined);
      createMediaStreamSource = () => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      });
      createAnalyser = () => ({
        fftSize: 2048,
        getFloatTimeDomainData: vi.fn(),
        disconnect: vi.fn(),
      });
    },
  );
  const constructed = vi.fn();
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported = () => true;
      state = "inactive";
      onstop: (() => void) | null = null;
      constructor() {
        constructed();
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    },
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  let recorder!: ReturnType<typeof useAudioRecorder>;
  function Harness() {
    const value = useAudioRecorder({});
    React.useEffect(() => {
      recorder = value;
    });
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Harness />));
  let oldStart!: Promise<void>;
  await act(async () => {
    oldStart = recorder.startRecording();
  });
  await act(async () => {
    recorder.reset();
  });
  await act(async () => {
    await recorder.startRecording();
  });
  await act(async () => {
    resumeOld();
    await oldStart;
  });
  expect(constructed).toHaveBeenCalledTimes(1);
  expect(recorder.status).toBe("recording");
  expect(tracks[0].stop).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  expect(tracks[1].stop).toHaveBeenCalledOnce();
});
