import { describe, expect, it } from "vitest";
import { computePeak, computeRms, mixToMono, normalizePeak } from "./pcmUtils";

describe("pcmUtils", () => {
  it("returns the original channel when only one channel is provided", () => {
    const channel = new Float32Array([0.1, -0.2, 0.3]);
    const result = mixToMono([channel]);
    expect(result).toBe(channel);
  });

  it("mixes multiple channels into mono", () => {
    const left = new Float32Array([1, -1]);
    const right = new Float32Array([0, 1]);
    const result = mixToMono([left, right]);
    expect(Array.from(result)).toEqual([0.5, 0]);
  });

  it("returns an empty array when given no channels", () => {
    const result = mixToMono([]);
    expect(result).toEqual(new Float32Array(0));
  });

  it("computes RMS correctly", () => {
    const samples = new Float32Array([1, -1]);
    expect(computeRms(samples)).toBeCloseTo(1, 5);
  });

  it("returns 0 RMS for empty buffers", () => {
    const samples = new Float32Array([]);
    expect(computeRms(samples)).toBe(0);
  });

  it("computes peak correctly", () => {
    const samples = new Float32Array([0.1, -0.9, 0.2]);
    expect(computePeak(samples)).toBeCloseTo(0.9, 5);
  });

  it("normalizes to the target peak", () => {
    const samples = new Float32Array([0.2, -0.4]);
    const normalized = normalizePeak(samples, 0.8);
    expect(computePeak(normalized)).toBeCloseTo(0.8, 5);
  });
});
