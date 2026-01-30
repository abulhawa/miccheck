/**
 * Mix multichannel audio samples into a single mono channel.
 */
export const mixToMono = (channels: Float32Array[]): Float32Array => {
  if (channels.length === 1) {
    return channels[0];
  }
  const length = channels[0].length;
  const mixed = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let sum = 0;
    for (const channel of channels) {
      sum += channel[i] ?? 0;
    }
    mixed[i] = sum / channels.length;
  }
  return mixed;
};

/**
 * Compute RMS for a PCM buffer.
 */
export const computeRms = (samples: Float32Array): number => {
  let total = 0;
  for (const sample of samples) {
    total += sample * sample;
  }
  return Math.sqrt(total / samples.length);
};

/**
 * Compute peak absolute amplitude.
 */
export const computePeak = (samples: Float32Array): number => {
  let peak = 0;
  for (const sample of samples) {
    const abs = Math.abs(sample);
    if (abs > peak) {
      peak = abs;
    }
  }
  return peak;
};

/**
 * Normalize samples to a target peak value.
 */
export const normalizePeak = (samples: Float32Array, target = 0.95): Float32Array => {
  const peak = computePeak(samples);
  if (peak === 0) return samples;
  const gain = target / peak;
  const normalized = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    normalized[i] = samples[i] * gain;
  }
  return normalized;
};
