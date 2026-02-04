import { describe, expect, it } from "vitest";
import { analyzeSamples } from "../src/index";
import {
  GOLDEN_SAMPLES,
  addEcho,
  clipSignal,
  generateNoise,
  generateSineWave,
  mixAtSNR
} from "./syntheticGenerator";

const computeRms = (samples: Float32Array): number => {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
};

const computePeak = (samples: Float32Array): number => {
  let peak = 0;
  for (const sample of samples) {
    const absValue = Math.abs(sample);
    if (absValue > peak) {
      peak = absValue;
    }
  }
  return peak;
};

const computeZeroCrossings = (samples: Float32Array): number => {
  let crossings = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i - 1] * samples[i] < 0) {
      crossings += 1;
    }
  }
  return crossings;
};

const computeSnrDb = (signal: Float32Array, noise: Float32Array): number => {
  const signalRms = computeRms(signal);
  const noiseRms = Math.max(1e-12, computeRms(noise));
  return 20 * Math.log10(signalRms / noiseRms);
};

const subtractSignals = (a: Float32Array, b: Float32Array): Float32Array => {
  const length = Math.min(a.length, b.length);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    output[i] = a[i] - b[i];
  }
  return output;
};

describe("Basic Signal Generation", () => {
  it("generateSineWave produces correct frequency", () => {
    const samples = generateSineWave(1000, 0.5, 48_000, 0.1);
    expect(samples.length).toBe(4800);
    const zeroCrossings = computeZeroCrossings(samples);
    expect(zeroCrossings).toBeGreaterThanOrEqual(198);
    expect(zeroCrossings).toBeLessThanOrEqual(202);
  });

  it("generateSineWave respects amplitude", () => {
    const amplitude = 0.7;
    const samples = generateSineWave(1000, amplitude, 48_000, 0.05);
    const peak = computePeak(samples);
    expect(peak).toBeCloseTo(amplitude, 3);
  });

  it("generateNoise has correct RMS", () => {
    const targetRms = 0.3;
    const samples = generateNoise(targetRms, 48_000, 1.0);
    const actualRms = computeRms(samples);
    expect(actualRms).toBeCloseTo(targetRms, 2);
  });

  it("noise is approximately white (uniform distribution)", () => {
    const samples = generateNoise(0.5, 48_000, 0.5);
    let sum = 0;
    for (const sample of samples) {
      sum += sample;
    }
    const mean = sum / samples.length;
    expect(Math.abs(mean)).toBeLessThan(0.01);
  });
});

describe("SNR Mixing Accuracy", () => {
  it("mixAtSNR produces exact SNR", () => {
    const signal = generateSineWave(1000, 0.5, 48_000, 1.0);
    const noise = generateNoise(0.1, 48_000, 1.0);
    const targetSNR = 20;
    const mixed = mixAtSNR(signal, noise, targetSNR);
    const noiseComponent = subtractSignals(mixed, signal);
    const actualSNR = computeSnrDb(signal, noiseComponent);
    expect(actualSNR).toBeCloseTo(targetSNR, 1);
  });

  it("mixAtSNR handles extreme SNR values", () => {
    const signal = generateSineWave(1000, 0.5, 48_000, 1.0);
    const noise = generateNoise(0.1, 48_000, 1.0);

    const mixedHigh = mixAtSNR(signal, noise, 60);
    const mixedHighRms = computeRms(mixedHigh);
    expect(mixedHighRms).toBeCloseTo(computeRms(signal), 3);

    const mixedLow = mixAtSNR(signal, noise, 5);
    const noiseComponent = subtractSignals(mixedLow, signal);
    const snrLow = computeSnrDb(signal, noiseComponent);
    expect(snrLow).toBeCloseTo(5, 1);
  });

  it("mixAtSNR with different length signals", () => {
    const shortSignal = generateSineWave(1000, 0.5, 48_000, 0.5);
    const longNoise = generateNoise(0.1, 48_000, 1.0);
    expect(() => mixAtSNR(shortSignal, longNoise, 20)).not.toThrow();
    expect(mixAtSNR(shortSignal, longNoise, 20).length).toBe(shortSignal.length);
  });
});

describe("Echo Generation", () => {
  it("addEcho creates correct delay", () => {
    const impulse = new Float32Array(48_000);
    impulse[0] = 1.0;
    const echoDelay = 100;
    const decay = 0.5;
    const echoed = addEcho(impulse, 48_000, echoDelay, decay);
    const echoPosition = Math.floor(48_000 * (echoDelay / 1000));
    expect(echoed[echoPosition]).toBeCloseTo(decay, 3);
  });

  it("addEcho respects decay factor", () => {
    const signal = generateSineWave(500, 0.8, 48_000, 0.2);
    const decay = 0.3;
    const echoed = addEcho(signal, 48_000, 50, decay);
    const echoStart = Math.floor(48_000 * 0.05);
    const echoSlice = echoed.subarray(echoStart, echoStart + 100);
    const originalSlice = signal.subarray(0, 100);
    const echoComponent = new Float32Array(echoSlice.length);
    for (let i = 0; i < echoSlice.length; i += 1) {
      echoComponent[i] = echoSlice[i] - signal[echoStart + i];
    }
    const echoRms = computeRms(echoComponent);
    const originalRms = computeRms(originalSlice);
    expect(echoRms).toBeCloseTo(originalRms * decay, 2);
  });
});

describe("Clipping Simulation", () => {
  it("clipSignal respects threshold", () => {
    const signal = generateSineWave(1000, 1.5, 48_000, 0.1);
    const threshold = 1.0;
    const clipped = clipSignal(signal, threshold);
    let maxSample = 0;
    for (const value of clipped) {
      const absValue = Math.abs(value);
      if (absValue > maxSample) {
        maxSample = absValue;
      }
    }
    expect(maxSample).toBeLessThanOrEqual(threshold + 1e-6);
  });

  it("clipSignal preserves unclipped portions", () => {
    const signal = generateSineWave(1000, 0.8, 48_000, 0.1);
    const clipped = clipSignal(signal, 1.0);
    for (let i = 0; i < signal.length; i += 1) {
      expect(clipped[i]).toBeCloseTo(signal[i], 6);
    }
  });

  it("clipSignal calculates correct clipping ratio", () => {
    const signal = new Float32Array([0.5, 0.9, 1.1, 0.3, -1.2, 0.7]);
    const clipped = clipSignal(signal, 1.0);
    let clippedSamples = 0;
    for (const value of clipped) {
      if (Math.abs(value) >= 0.999) {
        clippedSamples += 1;
      }
    }
    expect(clippedSamples).toBe(2);
  });
});

describe("Golden Samples Presets", () => {
  it("perfect sample has studio-quality metrics", () => {
    const sample = GOLDEN_SAMPLES.perfect(48_000);
    const rms = computeRms(sample);
    const rmsDb = 20 * Math.log10(rms);
    expect(rmsDb).toBeGreaterThan(-18.5);
    expect(rmsDb).toBeLessThan(-17.5);
  });

  it("all golden samples have correct duration", () => {
    const sampleRate = 48_000;
    const expectedDuration = 5.0;
    for (const generator of Object.values(GOLDEN_SAMPLES)) {
      const sample = generator(sampleRate);
      const duration = sample.length / sampleRate;
      expect(duration).toBeCloseTo(expectedDuration, 3);
    }
  });

  it("golden samples are deterministic", () => {
    const sample1 = GOLDEN_SAMPLES.goodCall(48_000);
    const sample2 = GOLDEN_SAMPLES.goodCall(48_000);
    expect(sample1.length).toBe(sample2.length);
    for (let i = 0; i < Math.min(sample1.length, 100); i += 1) {
      expect(sample1[i]).toBe(sample2[i]);
    }
  });
});

describe("Generator + Analysis Integration", () => {
  it("perfect sample gets A grade", () => {
    const sample = GOLDEN_SAMPLES.perfect(48_000);
    const result = analyzeSamples(sample, 48_000);
    expect(result.verdict.overall.grade).toBe("A");
    expect(result.verdict.dimensions.level.stars).toBe(5);
    expect(result.verdict.dimensions.noise.stars).toBe(5);
  });

  it("goodCall sample gets B grade with current thresholds", () => {
    const sample = GOLDEN_SAMPLES.goodCall(48_000);
    const result = analyzeSamples(sample, 48_000);
    expect(result.verdict.overall.grade).toBe("B");
    expect(result.metrics.snrDb).toBeGreaterThan(25);
    expect(result.metrics.snrDb).toBeLessThan(35);
  });

  it("clipped sample shows clipping detection", () => {
    const sample = GOLDEN_SAMPLES.clipped(48_000);
    const result = analyzeSamples(sample, 48_000);
    expect(result.metrics.clippingRatio).toBeGreaterThan(0.01);
    expect(result.verdict.dimensions.level.descriptionKey).toBe(
      "level.clipping_detected"
    );
  });

  it("echoey sample shows echo detection", () => {
    const sample = GOLDEN_SAMPLES.echoey(48_000);
    const result = analyzeSamples(sample, 48_000);
    expect(result.metrics.echoScore).toBeGreaterThan(0.3);
    expect(result.verdict.dimensions.echo.stars).toBeLessThan(4);
  });
});

describe("Edge Cases", () => {
  it("handles zero amplitude", () => {
    const sample = generateSineWave(1000, 0, 48_000, 0.1);
    expect(computeRms(sample)).toBeCloseTo(0, 6);
  });

  it("handles zero duration", () => {
    const sample = generateSineWave(1000, 0.5, 48_000, 0);
    expect(sample.length).toBe(0);
  });

  it("handles Nyquist frequency limit", () => {
    const sample = generateSineWave(24_000, 0.5, 48_000, 0.01);
    for (const value of sample) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("handles very high frequencies gracefully", () => {
    expect(() => generateSineWave(50_000, 0.5, 48_000, 0.01)).toThrow();
  });
});
