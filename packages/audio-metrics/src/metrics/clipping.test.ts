import { describe, expect, it } from "vitest";
import { measureClipping } from "./clipping";

describe("measureClipping", () => {
  it("detects clipped samples and peak level", () => {
    const samples = new Float32Array([0.6, -0.6, 0.1, 0.4]);
    const result = measureClipping(samples, 0.5);
    expect(result.clippingRatio).toBeCloseTo(0.5, 5);
    expect(result.peak).toBeCloseTo(0.6, 5);
  });
});
