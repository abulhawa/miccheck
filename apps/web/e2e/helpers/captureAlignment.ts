export interface PcmData {
  rate: number;
  samples: Float32Array;
}

// In-place radix-2 FFT for offline replay alignment. No app/model code is used.
function fft(real: Float64Array, imaginary: Float64Array, inverse = false) {
  const length = real.length;
  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let size = 2; size <= length; size *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size;
    const rotationReal = Math.cos(angle),
      rotationImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let wr = 1,
        wi = 0;
      for (let j = 0; j < size / 2; j++) {
        const a = start + j,
          b = a + size / 2;
        const br = real[b] * wr - imaginary[b] * wi;
        const bi = real[b] * wi + imaginary[b] * wr;
        real[b] = real[a] - br;
        imaginary[b] = imaginary[a] - bi;
        real[a] += br;
        imaginary[a] += bi;
        const next = wr * rotationReal - wi * rotationImaginary;
        wi = wr * rotationImaginary + wi * rotationReal;
        wr = next;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < length; i++) {
      real[i] /= length;
      imaginary[i] /= length;
    }
}

export function alignCapture(
  captured: PcmData,
  source: PcmData,
  quietSeconds: number,
) {
  const duration = Math.min(
    4,
    captured.samples.length / captured.rate - quietSeconds,
  );
  const count = Math.floor((duration - 0.2) * source.rate);
  if (count <= 0 || !source.samples.length)
    throw new Error("Insufficient alignment PCM");
  let length = 1;
  while (length < source.samples.length + count) length *= 2;
  const yr = new Float64Array(length),
    yi = new Float64Array(length);
  const xr = new Float64Array(length),
    xi = new Float64Array(length);
  const recording = new Float64Array(count);
  let xx = 0,
    yy = 0;
  for (let i = 0; i < source.samples.length + count; i++)
    yr[i] = source.samples[i % source.samples.length];
  for (let i = 0; i < count; i++) {
    const position = (quietSeconds + 0.2 + i / source.rate) * captured.rate;
    const index = Math.floor(position),
      fraction = position - index;
    const value =
      captured.samples[index] * (1 - fraction) +
      (captured.samples[index + 1] ?? captured.samples[index]) * fraction;
    xr[i] = recording[i] = value;
    xx += value * value;
    yy += yr[i] * yr[i];
  }
  if (xx === 0)
    return { offset: null, correlation: null, gain: null, residualRms: 0 };
  fft(yr, yi);
  fft(xr, xi);
  for (let i = 0; i < length; i++) {
    const real = yr[i] * xr[i] + yi[i] * xi[i];
    yi[i] = yi[i] * xr[i] - yr[i] * xi[i];
    yr[i] = real;
  }
  fft(yr, yi, true);
  let bestIndex = 0,
    bestCorrelation = -Infinity;
  // Cyclic correlation is exact on this range: source is extended by the full
  // capture window before zero padding, so no searched window crosses FFT end.
  for (let i = 0; i < source.samples.length; i++) {
    const correlation = yy > 0 ? yr[i] / Math.sqrt(xx * yy) : -Infinity;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestIndex = i;
    }
    const leaving = source.samples[i],
      entering = source.samples[(i + count) % source.samples.length];
    yy = Math.max(0, yy + entering * entering - leaving * leaving);
  }
  let best = {
    offset: bestIndex / source.rate - 0.2,
    correlation: -Infinity,
    gain: 0,
    residualRms: 0,
  };
  // Refine sub-sample offset against original PCM, not the FFT or model output.
  for (let delta = -1; delta <= 1; delta += 0.25) {
    let xy = 0,
      power = 0;
    for (let i = 0; i < count; i++) {
      const position =
        (bestIndex + delta + i + source.samples.length) % source.samples.length;
      const index = Math.floor(position),
        fraction = position - index;
      const value =
        source.samples[index] * (1 - fraction) +
        source.samples[(index + 1) % source.samples.length] * fraction;
      xy += recording[i] * value;
      power += value * value;
    }
    const correlation = power > 0 ? xy / Math.sqrt(xx * power) : -Infinity;
    if (correlation > best.correlation)
      best = {
        offset:
          ((bestIndex + delta) / source.rate -
            0.2 +
            source.samples.length / source.rate) %
          (source.samples.length / source.rate),
        correlation,
        gain: xy / power,
        residualRms: Math.sqrt(Math.max(0, xx - (xy * xy) / power) / count),
      };
  }
  return best;
}
