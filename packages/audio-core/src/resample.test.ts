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
});
