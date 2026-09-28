import { writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { analyzeGuidedSamples } from '../src/guided';

// Development: 22.05 kHz. Evaluation: new grids with the same noise shapes.
// Exact generated labels isolate the estimator, not VAD or real microphones.
const rows: object[] = [];
for (const rate of [22050, 24000, 96000]) {
  for (const shape of ['square', 'tone', 'broadband'] as const) {
    for (const condition of ['burst', 'stationary', 'spike', 'unfinished', 'boundary', 'below-threshold'] as const) {
      it(`${rate} Hz ${shape} ${condition}`, () => {
        const samples = new Float32Array(Math.round(5.2 * rate));
        let seed = rate === 22050 ? 91 : 812;
        for (let i = 0; i < samples.length; i++) {
          const t = i / rate;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const carrier = shape === 'square' ? (i % 2 ? -1 : 1)
            : shape === 'tone' ? Math.SQRT2 * Math.sin(2 * Math.PI * 997 * t)
              : Math.sqrt(3) * (seed / 4294967296 * 2 - 1);
          const elevated = condition === 'burst' && t >= 4.5 && t < 4.6
            || condition === 'spike' && t >= 4.5 && t < 4.51
            || condition === 'unfinished' && t >= 5.05
            || condition === 'boundary' && t >= 4 && t < 4.28;
          const gain = elevated ? 10 ** ((condition === 'burst' ? 7 : 18) / 20)
            : condition === 'below-threshold' && t >= 4.5 ? 10 ** (5 / 20) : 1;
          samples[i] = .003 * carrier * gain;
          if (t >= 2 && t < 4) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * t);
        }
        const result = analyzeGuidedSamples(samples, rate,
          { use_case: 'meetings', device_type: 'unknown', mode: 'basic' },
          { quietSeconds: 2, speechDetection: 'silero', segments: [{ start: 2, end: 4 }],
            capture: { format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        const expected = condition === 'burst' ? 'unstable' : condition === 'unfinished' ? 'unassessed' : 'stable';
        rows.push({ split: rate === 22050 ? 'development' : 'evaluation', rate, shape, condition, expected,
          actual: result.evidence?.noiseStability, retryReason: result.evidence?.retryReason ?? null,
          state: result.specialState ?? 'graded' });
        expect(result.evidence?.noiseStability).toBe(expected);
        expect(result.evidence?.retryReason).toBe(condition === 'burst' ? 'noise_unstable' : undefined);
        expect(result.specialState).toBe(condition === 'burst' ? 'INSUFFICIENT_EVIDENCE' : undefined);
      });
    }
  }
}
it('exports sample-grid evidence only when requested', () => {
  expect(rows).toHaveLength(54);
  const output = process.env.NOISE_GRID_REPORT;
  if (output) writeFileSync(new URL(`../../../docs/${output}`, import.meta.url), JSON.stringify({
    description: 'Exact generated noise-component labels; no human boundary or physical capture accuracy claim.',
    speechInterval: [2, 4], burstInterval: [4.5, 4.6], calibrationRms: .003,
    burstRiseDb: 7, controlRiseDb: 18, seeds: { development: 91, evaluation: 812 }, rows,
  }, null, 2) + '\n');
});
