import { expect, it } from "vitest";
import { alignCapture } from "../e2e/helpers/captureAlignment";

for (const offset of [0.05175, 1.9])
  it(`finds a known narrow correlation peak at ${offset} s including loop wrap`, () => {
    const rate = 8000;
    let seed = 12345;
    const samples = Float32Array.from({ length: rate * 2 }, (_, i) => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (
        0.1 * (((seed >>> 0) / 2 ** 32) * 2 - 1) +
        0.1 * Math.sin((2 * Math.PI * 1300 * i) / rate)
      );
    });
    const captured = new Float32Array(rate);
    for (let i = 0; i < captured.length; i++)
      captured[i] =
        samples[(Math.round(offset * rate) + i) % samples.length] * 1.5;
    const result = alignCapture(
      { rate, samples: captured },
      { rate, samples },
      0,
    );
    expect(result.offset).toBeCloseTo(offset, 4);
    expect(result.correlation).toBeGreaterThan(0.999);
    expect(result.gain).toBeCloseTo(1.5, 5);
    expect(result.residualRms).toBeLessThan(1e-7);
  });

it("reports undefined correlation for silent capture instead of inventing a match", () => {
  const result = alignCapture(
    { rate: 8000, samples: new Float32Array(8000) },
    { rate: 8000, samples: new Float32Array(16000).fill(0.1) },
    0,
  );
  expect(result.correlation).toBeNull();
});
