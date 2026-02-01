/**
 * Deterministic synthetic audio utilities for tests.
 */

const TWO_PI = Math.PI * 2;

const DEFAULT_SEED = 0x12345678;

const createDeterministicRng = (seed = DEFAULT_SEED) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
};

const calculateRms = (samples: Float32Array): number => {
  if (samples.length === 0) {
    return 0;
  }

  let sumSquares = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    sumSquares += value * value;
  }

  return Math.sqrt(sumSquares / samples.length);
};

const dbToLinear = (db: number): number => 10 ** (db / 20);

const linearToDb = (linear: number): number => {
  if (linear <= 0) {
    return -Infinity;
  }
  return 20 * Math.log10(linear);
};

const scaleSignal = (signal: Float32Array, gain: number): Float32Array => {
  const output = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i += 1) {
    output[i] = signal[i] * gain;
  }
  return output;
};

const mixSignals = (a: Float32Array, b: Float32Array): Float32Array => {
  const length = Math.min(a.length, b.length);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    output[i] = a[i] + b[i];
  }
  return output;
};

/**
 * Create a sine wave at a given frequency, amplitude, and duration.
 *
 * @param frequencyHz - Frequency in Hertz.
 * @param amplitude - Linear peak amplitude (0-1 corresponds to 0 dBFS peak).
 * @param sampleRate - Samples per second.
 * @param durationSeconds - Duration in seconds.
 */
export function generateSineWave(
  frequencyHz: number,
  amplitude: number,
  sampleRate: number,
  durationSeconds: number
): Float32Array {
  if (frequencyHz > sampleRate / 2) {
    throw new Error(
      `Frequency ${frequencyHz}Hz exceeds Nyquist limit of ${sampleRate / 2}Hz.`
    );
  }
  const length = Math.max(0, Math.floor(sampleRate * durationSeconds));
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i += 1) {
    samples[i] = amplitude * Math.sin(TWO_PI * frequencyHz * (i / sampleRate));
  }

  return samples;
}

/**
 * Generate deterministic white noise scaled to a target RMS level.
 *
 * @param rmsLevel - Linear RMS amplitude.
 * @param sampleRate - Samples per second.
 * @param durationSeconds - Duration in seconds.
 */
export function generateNoise(
  rmsLevel: number,
  sampleRate: number,
  durationSeconds: number
): Float32Array {
  const length = Math.max(0, Math.floor(sampleRate * durationSeconds));
  const samples = new Float32Array(length);
  const random = createDeterministicRng();

  for (let i = 0; i < length; i += 1) {
    samples[i] = random() * 2 - 1;
  }

  const currentRms = calculateRms(samples);
  const gain = currentRms === 0 ? 0 : rmsLevel / currentRms;
  return scaleSignal(samples, gain);
}

/**
 * Mix signal and noise at a precise SNR ratio.
 *
 * @param signal - Source signal.
 * @param noise - Noise signal.
 * @param targetSNRDb - Desired signal-to-noise ratio in dB.
 */
export function mixAtSNR(
  signal: Float32Array,
  noise: Float32Array,
  targetSNRDb: number
): Float32Array {
  const length = Math.min(signal.length, noise.length);
  const trimmedSignal = signal.subarray(0, length);
  const trimmedNoise = noise.subarray(0, length);

  const signalRms = calculateRms(trimmedSignal);
  const desiredNoiseRms = signalRms / dbToLinear(targetSNRDb);
  const noiseRms = calculateRms(trimmedNoise);
  const noiseGain = noiseRms === 0 ? 0 : desiredNoiseRms / noiseRms;
  const scaledNoise = scaleSignal(trimmedNoise, noiseGain);

  return mixSignals(trimmedSignal, scaledNoise);
}

/**
 * Add a single-tap echo to a signal.
 *
 * @param signal - Source signal.
 * @param sampleRate - Samples per second.
 * @param delayMs - Delay time in milliseconds.
 * @param decay - Echo decay amount (0-1).
 */
export function addEcho(
  signal: Float32Array,
  sampleRate: number,
  delayMs: number,
  decay: number
): Float32Array {
  const output = new Float32Array(signal.length);
  const delaySamples = Math.max(0, Math.round((delayMs / 1000) * sampleRate));

  for (let i = 0; i < signal.length; i += 1) {
    output[i] = signal[i];
    const delayedIndex = i - delaySamples;
    if (delayedIndex >= 0) {
      output[i] += signal[delayedIndex] * decay;
    }
  }

  return output;
}

/**
 * Hard-clip a signal above a specified threshold.
 *
 * @param signal - Source signal.
 * @param threshold - Absolute clip threshold (0-1).
 */
export function clipSignal(
  signal: Float32Array,
  threshold: number
): Float32Array {
  const output = new Float32Array(signal.length);
  const limit = Math.abs(threshold);

  for (let i = 0; i < signal.length; i += 1) {
    const value = signal[i];
    if (value > limit) {
      output[i] = limit;
    } else if (value < -limit) {
      output[i] = -limit;
    } else {
      output[i] = value;
    }
  }

  return output;
}

/**
 * Curated golden sample presets for grading tests.
 */
export const GOLDEN_SAMPLES = {
  /**
   * -18 dBFS (RMS) sine at 1 kHz, 45 dB SNR, 5 seconds.
   */
  perfect: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const signalRms = dbToLinear(-18);
    const amplitude = signalRms * Math.SQRT2;
    const signal = generateSineWave(1000, amplitude, sampleRate, durationSeconds);
    const noise = generateNoise(1, sampleRate, durationSeconds);
    return mixAtSNR(signal, noise, 45);
  },

  /**
   * -22 dBFS (RMS) sine at 1 kHz, 28 dB SNR.
   */
  goodCall: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const signalRms = dbToLinear(-22);
    const amplitude = signalRms * Math.SQRT2;
    const signal = generateSineWave(1000, amplitude, sampleRate, durationSeconds);
    const noise = generateNoise(1, sampleRate, durationSeconds);
    return mixAtSNR(signal, noise, 28);
  },

  /**
   * -26 dBFS (RMS) sine at 1 kHz, 18 dB SNR.
   */
  needsWork: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const signalRms = dbToLinear(-26);
    const amplitude = signalRms * Math.SQRT2;
    const signal = generateSineWave(1000, amplitude, sampleRate, durationSeconds);
    const noise = generateNoise(1, sampleRate, durationSeconds);
    return mixAtSNR(signal, noise, 18);
  },

  /**
   * -30 dBFS (RMS) sine at 1 kHz, 12 dB SNR.
   */
  poor: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const signalRms = dbToLinear(-30);
    const amplitude = signalRms * Math.SQRT2;
    const signal = generateSineWave(1000, amplitude, sampleRate, durationSeconds);
    const noise = generateNoise(1, sampleRate, durationSeconds);
    return mixAtSNR(signal, noise, 12);
  },

  /**
   * 0 dBFS (RMS) sine at 1 kHz, hard-clipped at 0.99.
   */
  clipped: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const signalRms = dbToLinear(0);
    const amplitude = signalRms * Math.SQRT2;
    const signal = generateSineWave(1000, amplitude, sampleRate, durationSeconds);
    return clipSignal(signal, 0.99);
  },

  /**
   * Speech-like blend with echo: 200 ms delay, 0.6 decay.
   */
  echoey: (sampleRate = 48_000): Float32Array => {
    const durationSeconds = 5;
    const baseRms = dbToLinear(-24);
    const baseAmplitude = baseRms * Math.SQRT2;
    const low = generateSineWave(220, baseAmplitude, sampleRate, durationSeconds);
    const mid = generateSineWave(440, baseAmplitude * 0.7, sampleRate, durationSeconds);
    const high = generateSineWave(880, baseAmplitude * 0.4, sampleRate, durationSeconds);
    const blended = mixSignals(mixSignals(low, mid), high);
    return addEcho(blended, sampleRate, 200, 0.6);
  }
};

export const SYNTHETIC_UTILS = {
  calculateRms,
  dbToLinear,
  linearToDb
};
