import { describe, expect, it } from "vitest";
import { analyzeSamples } from "./index";

describe("analyzeSamples", () => {
  it("returns a stable summary for a constant signal fixture", () => {
    const samples = new Float32Array(48000).fill(0.1);
    const summary = analyzeSamples(samples, 48000);

    expect(summary.grade).toBe("F");
    expect(summary.recommendation.category).toBe("Noise");
    expect(summary.categories.level.label).toBe("Level");
    expect(summary.categories.noise.label).toBe("Noise");
    expect(summary.categories.echo.label).toBe("Echo");
    expect(summary.primaryIssueCategory).toBe("noise");
    expect(summary.explanation).toBe(
      "Background noise is overpowering the voice."
    );
    expect(summary.fix).toBe(
      "Silence the room or use a close mic to improve SNR."
    );
  });

  it("keeps echo grading stable for short buffers", () => {
    const sampleRate = 48000;
    const maxLag = Math.floor(sampleRate * 0.2);
    const samples = new Float32Array(maxLag).fill(0.1);
    const summary = analyzeSamples(samples, sampleRate);

    expect(summary.categories.echo.description).toBe("Minimal echo");
    expect(summary.metrics.echoScore).toBe(0);
    expect(Number.isNaN(summary.metrics.echoScore)).toBe(false);
    expect(Object.is(summary.metrics.echoScore, -0)).toBe(false);
  });
});
