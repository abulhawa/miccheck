import { describe, expect, it } from "vitest";
import { analyzeSamples } from "./index";

describe("analyzeSamples", () => {
  it("returns a stable summary for a constant signal fixture", () => {
    const samples = new Float32Array(48000).fill(0.1);
    const summary = analyzeSamples(samples, 48000);

    expect(summary.grade).toBe("D");
    expect(summary.recommendation.category).toBe("Noise");
    expect(summary.categories.level.label).toBe("Level");
    expect(summary.categories.noise.label).toBe("Noise");
    expect(summary.categories.echo.label).toBe("Echo");
  });
});
