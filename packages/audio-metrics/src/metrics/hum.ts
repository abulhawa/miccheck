/** Dominant mains-tone energy fraction, searched within ±2 Hz of 50/60 Hz.
 * Hann windows limit spectral leakage; coherent-gain normalization makes the
 * sinusoidal power estimate independent of duration and sample rate.
 */
export function measureHum(samples: Float32Array, sampleRate: number): number {
  if (sampleRate < 128 || samples.length < sampleRate * 0.25) return 0;
  const size = Math.min(samples.length, Math.round(sampleRate));
  let weightedHum = 0;
  let weightedEnergy = 0;
  for (let start = 0; start + size <= samples.length; start += size) {
    const windowed = new Float64Array(size);
    let mean = 0;
    for (let i = 0; i < size; i++) mean += samples[start + i];
    mean /= size;
    let energy = 0;
    let weightSum = 0;
    for (let i = 0; i < size; i++) {
      const value = samples[start + i] - mean;
      const weight = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
      windowed[i] = value * weight;
      weightSum += weight;
      energy += value * value / size;
    }
    let peakPower = 0;
    for (const center of [50, 60]) {
      for (let frequency = center - 2; frequency <= center + 2; frequency += 0.5) {
        const omega = 2 * Math.PI * frequency / sampleRate;
        const coefficient = 2 * Math.cos(omega);
        let previous = 0;
        let beforePrevious = 0;
        for (const value of windowed) {
          const current = value + coefficient * previous - beforePrevious;
          beforePrevious = previous;
          previous = current;
        }
        const power = previous ** 2 + beforePrevious ** 2 - coefficient * previous * beforePrevious;
        peakPower = Math.max(peakPower, 2 * power / (weightSum ** 2));
      }
    }
    weightedHum += Math.min(energy, Math.max(0, peakPower));
    weightedEnergy += energy;
  }
  return weightedEnergy > 1e-12 ? Math.min(1, weightedHum / weightedEnergy) : 0;
}
