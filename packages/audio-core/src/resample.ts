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
