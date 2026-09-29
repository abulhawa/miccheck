import { expect, it } from 'vitest';
// @ts-expect-error Shared offline evidence module is JavaScript.
import { repeatabilitySetupSignature, summarize, summarizeTakes } from '../scripts/repeatability-summary.mjs';

it('reports sample variability without treating pairs as independent takes', () => {
  expect(summarize([1, 2, 3])).toMatchObject({ n: 3, mean: 2, median: 2, sampleSd: 1, range: 2, pairCount: 3, absolutePairDifferences: [1, 2, 1], pairDifferencesAreIndependent: false });
  expect(summarize([2]).sampleSd).toBeNull();
  expect(summarize([1, undefined])).toBeNull();
});

it('retains invalid outcomes and separates comparable evidence without inventing thresholds', () => {
  const take = (id: string, stable: boolean) => ({ id, analysis: { metrics: { speechRmsDb: -20, snrDb: 30, speechClippingRatio: 0, clippedDurationSeconds: 0, humRatio: 0 }, evidence: { capture: { format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false }, noiseReliable: stable, noiseStability: stable ? 'stable' : 'unassessed', speechSeconds: 10 }, verdict: { overall: { grade: 'A' } } } });
  expect(summarizeTakes([take('a', true), take('b', false)])).toMatchObject({ totalTakes: 2, eligibleTakes: 1, excludedIds: ['b'], meaningfulChangeThreshold: null, metrics: { speechRmsDb: { all: { n: 2 }, eligible: { n: 1 } } } });
});


it('ignores volatile latency metadata while preserving setup invariants', () => {
  const take = (baseLatency: number, sampleRate = 48000) => ({
    passage: 'same passage',
    deviceId: 'mic-1',
    captureDetails: {
      trackSettings: {
        deviceId: 'mic-1',
        groupId: 'group-1',
        channelCount: 1,
        sampleRate,
        sampleSize: 16,
        latency: baseLatency * 2,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      audioContext: { sampleRate, baseLatency, outputLatency: baseLatency * 3 },
    },
    analysis: {
      evidence: { capture: { format: 'pcm', echoCancellation: false, noiseSuppression: false, autoGainControl: false } },
      verdict: { context: { use_case: 'meetings', device_type: 'unknown', mode: 'basic' } },
    },
  });
  expect(repeatabilitySetupSignature(take(0.01))).toEqual(repeatabilitySetupSignature(take(0.02)));
  expect(repeatabilitySetupSignature(take(0.01))).not.toEqual(repeatabilitySetupSignature(take(0.01, 44100)));
});
