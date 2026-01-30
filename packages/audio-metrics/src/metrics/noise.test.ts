import { describe, expect, it } from "vitest";
import { measureNoise } from "./noise";

describe("measureNoise", () => {
  it("returns zeros for empty buffers", () => {
    const result = measureNoise(new Float32Array([]), 48000);
    expect(result).toEqual({ noiseFloor: 0, snrDb: 0, humRatio: 0 });
  });
});
