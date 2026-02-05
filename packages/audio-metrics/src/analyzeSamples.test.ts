import { describe, expect, it } from "vitest";
import { analyzeSamples } from "./index";

describe("analyzeSamples", () => {
  it("returns a stable summary for a constant signal fixture", () => {
    const samples = new Float32Array(48000).fill(0.1);
    const summary = analyzeSamples(samples, 48000);

    expect(summary.verdict.overall.grade).toBe("F");
    expect(summary.recommendation.category).toBe("Noise");
    expect(summary.verdict.dimensions.level.labelKey).toBe("category.level");
    expect(summary.verdict.dimensions.noise.labelKey).toBe("category.noise");
    expect(summary.verdict.dimensions.echo.labelKey).toBe("category.echo");
    expect(summary.verdict.primaryIssue).toBe("noise");
    expect(summary.verdict.copyKeys.explanationKey).toBe("explanation.very_noisy");
    expect(summary.verdict.copyKeys.fixKey).toBe("fix.silence_room_close_mic");
  });

  it("applies default context when no context is provided", () => {
    const samples = new Float32Array(48000).fill(0.1);
    const summary = analyzeSamples(samples, 48000);

    expect(summary.verdict.context).toEqual({
      use_case: "meetings",
      device_type: "unknown",
      mode: "single"
    });
  });

  it("allows explicit context overrides", () => {
    const samples = new Float32Array(48000).fill(0.1);
    const summary = analyzeSamples(samples, 48000, {
      mode: "pro",
      use_case: "podcast",
      device_type: "usb_mic"
    });

    expect(summary.verdict.context).toEqual({
      mode: "pro",
      use_case: "podcast",
      device_type: "usb_mic"
    });
  });

  it("keeps echo grading stable for short buffers", () => {
    const sampleRate = 48000;
    const maxLag = Math.floor(sampleRate * 0.2);
    const samples = new Float32Array(maxLag).fill(0.1);
    const summary = analyzeSamples(samples, sampleRate);

    expect(summary.verdict.dimensions.echo.descriptionKey).toBe("echo.minimal");
    expect(summary.metrics.echoScore).toBe(0);
    expect(Number.isNaN(summary.metrics.echoScore)).toBe(false);
    expect(Object.is(summary.metrics.echoScore, -0)).toBe(false);
  });
});
