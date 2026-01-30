import { describe, expect, it } from "vitest";
import { measureLevel } from "./level";

describe("measureLevel", () => {
  it("returns RMS and RMS dBFS values", () => {
    const samples = new Float32Array([0, 1, -1, 0]);
    const result = measureLevel(samples);
    expect(result.rms).toBeCloseTo(Math.SQRT1_2, 5);
    expect(result.rmsDb).toBeCloseTo(-3.0103, 3);
  });
});
