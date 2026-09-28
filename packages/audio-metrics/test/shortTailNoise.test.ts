import { expect, it } from 'vitest';
import { analyzeGuidedSamples } from '../src/guided';

// Exact component/event intervals; capture lengths and seeds differ between
// development and evaluation. This does not annotate human speech boundaries.
for (const [split, rate, tail, seedStart] of [
  ['development', 16000, .75, 91],
  ['evaluation', 44100, .72, 812],
  ['evaluation', 48000, .78, 731],
] as const) {
  for (const condition of ['burst', 'stationary', 'spike', 'unfinished', 'boundary'] as const) {
    it(`${split}: ${rate} Hz short tail ${condition}`, () => {
      const samples = new Float32Array(Math.round((4 + tail) * rate));
      let seed = seedStart;
      for (let i = 0; i < samples.length; i++) {
        const t = i / rate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const elevated = condition === 'burst' && t >= 4.5 && t < 4.6
          || condition === 'spike' && t >= 4.5 && t < 4.51
          || condition === 'unfinished' && t >= 4.5
          || condition === 'boundary' && t >= 4 && t < 4.28;
        samples[i] = (seed / 4294967296 * 2 - 1) * (elevated ? .065 : .0008);
        if (t >= 2 && t < 4) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * t);
      }
      const result = analyzeGuidedSamples(samples, rate,
        {use_case: 'meetings', device_type: 'unknown', mode: 'basic'},
        {quietSeconds: 2, speechDetection: 'silero', segments: [{start: 2, end: 4}],
          capture: {format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false}});
      expect(result.evidence?.noiseStability).toBe(condition === 'burst' ? 'unstable' : 'unassessed');
      expect(result.evidence?.laterNoiseSeconds).toBeLessThan(.5);
      expect(result.evidence?.retryReason).toBe(condition === 'burst' ? 'noise_unstable' : undefined);
      expect(result.specialState).toBe(condition === 'burst' ? 'INSUFFICIENT_EVIDENCE' : undefined);
      expect(result.verdict.diagnosticCertainty).toBe('low');
    });
  }
}
