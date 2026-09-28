import {expect, it} from 'vitest';
// @ts-expect-error Standalone benchmark helper is plain JavaScript.
import {evaluateSpeechAnnotations} from '../scripts/evaluate-speech-annotations.mjs';

const clip = {
  durationSeconds: 4,
  intervals: [
    {start: 0, end: 1, label: 'nonspeech'},
    {start: 1, end: 2, label: 'speech'},
    {start: 2, end: 3, label: 'uncertain'},
    {start: 3, end: 4, label: 'nonspeech'},
  ],
  words: [{start: 1, end: 2}],
};

it('accounts for offset, uncertainty, source bounds, and fractional intersections', () => {
  const result = evaluateSpeechAnnotations(clip, [{start: 2.5, end: 3.5}, {start: 4.5, end: 7}]);
  expect(result.seconds).toEqual({truePositive: .5, falsePositive: 1.5, falseNegative: .5, trueNegative: .5, excludedUncertain: 1});
  expect(result.evaluatedCoverage).toBe(.75);
  expect(result.pseudoLabelAgreementPrecision).toBe(.25);
  expect(result.pseudoLabelAgreementRecall).toBe(.5);
  expect(result.candidateBoundaryDifferences.firstStartSeconds).toBe(-.5);
});

it('unions overlaps and returns null for undefined precision', () => {
  expect(evaluateSpeechAnnotations(clip, [{start: 3, end: 4}, {start: 3.5, end: 4.5}]).seconds.truePositive).toBe(1);
  const result = evaluateSpeechAnnotations(clip, []);
  expect(result.pseudoLabelAgreementPrecision).toBeNull();
  expect(result.pseudoLabelAgreementRecall).toBe(0);
  expect(result.candidateBoundaryDifferences.firstStartSeconds).toBeNull();
});

it('rejects incomplete partitions, invalid durations, and nonfinite detector segments', () => {
  expect(() => evaluateSpeechAnnotations({...clip, intervals: clip.intervals.slice(1)}, [])).toThrow();
  expect(() => evaluateSpeechAnnotations({...clip, durationSeconds: 0}, [])).toThrow();
  expect(() => evaluateSpeechAnnotations(clip, [{start: NaN, end: 3}])).toThrow();
  expect(() => evaluateSpeechAnnotations(clip, [{start: 4, end: 3}])).toThrow();
});
