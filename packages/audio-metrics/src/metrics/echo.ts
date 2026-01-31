export interface EchoMetrics {
  echoScore: number;
}

const computeAutocorrelation = (
  samples: Float32Array,
  lag: number
): number => {
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

  if (samples.length <= maxLag) {
    // Too few samples to compute reliable autocorrelation; treat as minimal echo.
    return { echoScore: 0 };
  }

  for (let lag = minLag; lag <= maxLag; lag += Math.floor(sampleRate * 0.01)) {
    const correlation = computeAutocorrelation(samples, lag);
    if (correlation > peakCorrelation) {
      peakCorrelation = correlation;
    }
  }

  const normalized = Math.min(1, Math.max(0, peakCorrelation * 4));
  return { echoScore: normalized };
};
