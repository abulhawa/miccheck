/**
 * Linear resampler for PCM data.
 */
export const resampleLinear = (
  samples: Float32Array,
  sourceRate: number,
  targetRate: number
): Float32Array => {
  if (samples.length === 0) return samples;
  if (sourceRate === targetRate) return samples;
  const ratio = targetRate / sourceRate;
  const length = Math.max(1, Math.floor(samples.length * ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i / ratio;
    const left = Math.floor(position);
    const right = Math.min(samples.length - 1, left + 1);
    const mix = position - left;
    output[i] = samples[left] * (1 - mix) + samples[right] * mix;
  }
  return output;
};

/** Windowed-sinc resampling with a low-pass filter before downsampling.
 * Keeps energy above the target Nyquist frequency out of ML input bands.
 */
export function resampleBandlimited(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (![sourceRate, targetRate].every((rate) => Number.isFinite(rate) && rate > 0)) throw new Error('Invalid sample rate');
  if (sourceRate === targetRate) return samples.slice();
  const output = new Float32Array(Math.floor(samples.length * targetRate / sourceRate));
  const cutoff = 0.45 * Math.min(1, targetRate / sourceRate);
  const radius = Math.ceil(24 / Math.min(1, targetRate / sourceRate));
  for (let i = 0; i < output.length; i++) {
    const position = i * sourceRate / targetRate;
    let value = 0;
    let totalWeight = 0;
    for (let j = Math.max(0, Math.ceil(position - radius)); j <= Math.min(samples.length - 1, Math.floor(position + radius)); j++) {
      const distance = position - j;
      const sinc = Math.abs(distance) < 1e-8 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * distance) / (Math.PI * distance);
      const window = 0.5 + 0.5 * Math.cos(Math.PI * distance / radius);
      const weight = sinc * window;
      value += samples[j] * weight;
      totalWeight += weight;
    }
    output[i] = totalWeight ? value / totalWeight : 0;
  }
  return output;
}
