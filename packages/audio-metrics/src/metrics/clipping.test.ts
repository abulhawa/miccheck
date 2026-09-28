import { describe, expect, it } from "vitest";
import { measureClipping } from "./clipping";

describe("measureClipping", () => {
  it("detects clipped samples and peak level", () => {
    const samples = new Float32Array([0.6, -0.6, 0.1, 0.4]);
    const result = measureClipping(samples, 0.5);
    expect(result.clippingRatio).toBeCloseTo(0.5, 5);
    expect(result.peak).toBeCloseTo(0.6, 5);
  });
  it("groups consecutive threshold samples without merging gaps or splitting polarity", () => {
    const result = measureClipping(new Float32Array([0.5, -0.5, 0, 0.7, 0, -0.8]), 0.5);
    expect(result.nearFullScaleSampleCount).toBe(4);
    expect(result.clippingEventCount).toBe(3);
    expect(result.clippingRatio).toBeCloseTo(4 / 6);
  });
  it("preserves event count and sample duration when silence is appended", () => {
    const before = measureClipping(new Float32Array([1, 1, 0, -1]));
    const after = measureClipping(new Float32Array([1, 1, 0, -1, 0, 0]));
    expect(after.clippingEventCount).toBe(before.clippingEventCount);
    expect(after.nearFullScaleSampleCount).toBe(before.nearFullScaleSampleCount);
  });
  it("returns no events for empty or below-threshold audio", () => {
    for (const samples of [new Float32Array(), new Float32Array([0, 0.2])]) {
      expect(measureClipping(samples).clippingEventCount).toBe(0);
      expect(measureClipping(samples).nearFullScaleSampleCount).toBe(0);
    }
  });
});
