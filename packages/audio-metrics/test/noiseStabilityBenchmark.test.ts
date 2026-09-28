import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeGuidedSamples } from '../src/guided';

// Generated intervals are exact annotations, not inferred human speech labels.
// This isolates the estimator; it deliberately does not evaluate Silero.
const context = {use_case: 'meetings' as const, device_type: 'unknown' as const, mode: 'basic' as const};
const rows: object[] = [];
describe('controlled noise stability benchmark', () => {
  for (const rate of [8000, 16000, 48000]) {
    for (const shape of ['broadband', 'tone'] as const) {
      for (const floorDb of [-70, -50, -30]) {
        for (const condition of ['stationary', 'increase', 'decrease', 'short-gap', 'boundary-residue', 'burst', 'short-burst', 'near-threshold'] as const) {
          it(`${rate} Hz ${shape} ${floorDb} dBFS ${condition}`, () => {
            const tail = condition === 'short-gap' ? 0.6 : 1.2;
            const samples = new Float32Array(Math.round(rate * (4 + tail)));
            const base = 10 ** (floorDb / 20);
            let seed = 12345;
            for (let i = 0; i < samples.length; i++) {
              const t = i / rate;
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              const noise = shape === 'tone' ? Math.SQRT2 * Math.sin(2 * Math.PI * 997 * t) : Math.sqrt(3) * (seed / 4294967296 * 2 - 1);
              let gain = 1;
              if (t >= 4.2) {
                if (condition === 'increase') gain = 10 ** (12 / 20);
                if (condition === 'decrease') gain = 10 ** (-12 / 20);
                if (condition === 'near-threshold') gain = 10 ** (5 / 20);
                if (condition === 'burst' && t >= 4.45 && t < 4.95) gain = 10 ** (18 / 20);
                if (condition === 'short-burst' && t >= 4.5 && t < 4.6) gain = 10 ** (18 / 20);
              }
              samples[i] = base * gain * noise;
              if (t >= 2 && t < 4) samples[i] += 0.1 * Math.sin(2 * Math.PI * 200 * t);
              if (condition === 'boundary-residue' && t >= 4 && t < 4.18) samples[i] += 0.1 * Math.sin(2 * Math.PI * 200 * t);
            }
            const result = analyzeGuidedSamples(samples, rate, context, {
              quietSeconds: 2, speechDetection: 'silero', segments: [{start: 2, end: 4}],
              capture: {format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false}
            });
            // Below-floor changes are intentionally suppressed. A -70 -> -58 dBFS
            // increase is only 2 dB above the comparison floor.
            // Acceptance requirement: brief +18 dB events must also be detected.
            // The current implementation misses these; keep the tests failing
            // until detection improves, rather than asserting the known miss.
            const changed = ['burst', 'short-burst'].includes(condition) || (['increase', 'decrease'].includes(condition) && floorDb > -60);
            const expected = condition === 'short-gap' ? 'unassessed' : changed ? 'unstable' : 'stable';
            rows.push({rate, shape, floorDb, condition, expected, actual: result.evidence?.noiseStability,
              usableSeconds: result.evidence?.laterNoiseSeconds, maxChangeDb: result.evidence?.maxNoiseChangeDb});
            expect(result.evidence?.noiseStability).toBe(expected);
            expect(result.evidence?.noiseReliable).toBe(!changed);
            expect(result.evidence?.retryReason).toBe(changed ? 'noise_unstable' : undefined);
          });
        }
      }
    }
  }
  it('exports reproducible diagnostic results when requested', () => {
    expect(rows).toHaveLength(144);
    if (process.env.UPDATE_NOISE_BENCHMARK === '1') {
      writeFileSync(new URL('../../../docs/noise-stability-results.json', import.meta.url), JSON.stringify({
        description: 'Controlled synthetic estimator evaluation with exact generated intervals; no human annotation or VAD accuracy claim.',
        seed: 12345, calibrationSeconds: 2, speechInterval: [2, 4], rows
      }, null, 2) + '\n');
    }
  });
});
