import { describe, expect, it, vi } from "vitest";
import { detectVoiceActivity } from "@miccheck/audio-core";
import { measureNoise } from "./noise";

vi.mock("@miccheck/audio-core", () => ({
  detectVoiceActivity: vi.fn()
}));

const mockedDetectVoiceActivity = vi.mocked(detectVoiceActivity);

describe("measureNoise", () => {
  it("returns zeros for empty buffers", () => {
    const result = measureNoise(new Float32Array([]), 48000);
    expect(result).toEqual({ noiseFloor: 0, snrDb: 0, humRatio: 0, confidence: "low" });
  });

  it("separates constant noise from intermittent speech", () => {
    const sampleRate = 48000;
    const samples = new Float32Array(sampleRate);
    for (let i = 0; i < sampleRate / 2; i += 1) {
      samples[i] = 0.1;
    }
    for (let i = sampleRate / 2; i < sampleRate; i += 1) {
      samples[i] = 0.3;
    }

    const frameSize = 2400;
    const totalFrames = 20;
    const frameRms = Array.from({ length: totalFrames }, (_, index) =>
      index < 10 ? 0.1 : 0.3
    );
    const isSpeechFrame = Array.from({ length: totalFrames }, (_, index) => index >= 10);
    const frames = frameRms.map((rms, index) => ({ rms, isSpeech: isSpeechFrame[index] }));

    mockedDetectVoiceActivity.mockReturnValue({
      frames,
      frameRms,
      isSpeechFrame,
      speechRatio: 0.5,
      averageSpeechRms: 0.3,
      frameSize
    });

    const result = measureNoise(samples, sampleRate, 50);

    expect(result.noiseFloor).toBeCloseTo(0.1, 3);
    expect(result.snrDb).toBeCloseTo(9.5, 1);
    expect(result.confidence).toBe("high");
  });
});
