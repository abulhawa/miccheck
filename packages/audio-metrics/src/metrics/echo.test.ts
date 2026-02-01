import { describe, expect, it } from "vitest";
import { measureEcho } from "./echo";

describe("measureEcho", () => {
  it("returns a neutral echo score for buffers shorter than the max lag", () => {
    const sampleRate = 48000;
    const maxLag = Math.floor(sampleRate * 0.2);
    const samples = new Float32Array(maxLag).fill(0.2);
    const result = measureEcho(samples, sampleRate);

    expect(result.echoScore).toBe(0);
    expect(result.confidence).toBe("low");
    expect(Number.isNaN(result.echoScore)).toBe(false);
    expect(Object.is(result.echoScore, -0)).toBe(false);
  });
});
