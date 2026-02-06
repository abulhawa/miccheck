export interface EchoMetrics {
  echoScore: number;
  confidence: "low" | "medium" | "high";
}

const computeAutocorrelation = (samples: Float32Array, lag: number): number => {
  if (samples.length <= lag) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < samples.length - lag; i += 1) {
    sum += samples[i] * samples[i + lag];
  }
  return sum / (samples.length - lag);
};

/**
 * Estimate echo using autocorrelation between 80–200ms.
 */
export const measureEcho = (
  samples: Float32Array,
  sampleRate: number
): EchoMetrics => {
  const minLag = Math.floor(sampleRate * 0.08);
  const maxLag = Math.floor(sampleRate * 0.2);
  let peakCorrelation = 0;
  const correlations: number[] = [];

  if (samples.length <= maxLag) {
    // Too few samples to compute reliable autocorrelation; treat as minimal echo.
    return { echoScore: 0, confidence: "low" };
  }

  let energy = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = samples[i];
    energy += value * value;
  }
  const averageEnergy = energy / samples.length;
  if (averageEnergy < 1e-10 || samples.length < sampleRate * 0.1) {
    return { echoScore: 0, confidence: "low" };
  }

  const lagStep = Math.max(1, Math.floor(sampleRate * 0.01));
  for (let lag = minLag; lag <= maxLag; lag += lagStep) {
    const correlation = computeAutocorrelation(samples, lag) / averageEnergy;
    const normalized = Math.max(0, correlation);
    correlations.push(normalized);
    if (normalized > peakCorrelation) {
      peakCorrelation = normalized;
    }
  }

  if (correlations.length === 0) {
    return { echoScore: 0, confidence: "low" };
  }

  const meanCorrelation =
    correlations.reduce((sum, value) => sum + value, 0) / correlations.length;
  let maxLocalContrast = 0;
  for (let i = 0; i < correlations.length; i += 1) {
    const start = Math.max(0, i - 2);
    const end = Math.min(correlations.length, i + 3);
    let neighborSum = 0;
    let neighborCount = 0;
    for (let j = start; j < end; j += 1) {
      if (j === i) continue;
      neighborSum += correlations[j];
      neighborCount += 1;
    }
    const localMean = neighborCount > 0 ? neighborSum / neighborCount : meanCorrelation;
    const contrast = correlations[i] - localMean;
    if (contrast > maxLocalContrast) {
      maxLocalContrast = contrast;
    }
  }

  const normalized =
    meanCorrelation >= 0.999
      ? 0
      : Math.min(1, Math.max(0, maxLocalContrast / (1 - meanCorrelation)));

  return { echoScore: normalized, confidence: "high" };
};
