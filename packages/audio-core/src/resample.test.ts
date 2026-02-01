import { describe, expect, it } from "vitest";
import { resampleLinear } from "./resample";

describe("resampleLinear", () => {
  it("returns the same buffer when sample rates match", () => {
    const samples = new Float32Array([0, 1, 0]);
    const result = resampleLinear(samples, 48000, 48000);
    expect(result).toBe(samples);
  });

  it("upsamples with linear interpolation", () => {
    const samples = new Float32Array([0, 1]);
    const result = resampleLinear(samples, 2, 4);
    expect(Array.from(result)).toEqual([0, 0.5, 1, 1]);
  });

  it("downsamples with linear interpolation", () => {
    const samples = new Float32Array([0, 1, 0, 1]);
    const result = resampleLinear(samples, 4, 3);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeCloseTo(2 / 3, 6);
    expect(result[2]).toBeCloseTo(2 / 3, 6);
  });

  it("returns an empty buffer for empty input without NaN values", () => {
    const samples = new Float32Array([]);
    const result = resampleLinear(samples, 48000, 44100);
    expect(result.length).toBe(0);
    expect(Array.from(result).some((value) => Number.isNaN(value))).toBe(false);
  });
});
