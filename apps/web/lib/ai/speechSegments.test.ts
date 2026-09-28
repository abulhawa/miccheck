import {expect,it} from 'vitest';
import {speechSegments} from './silero';
import {selectSoundHint} from './sounds';

it('ignores isolated speech spikes and preserves sustained speech', () => {
  expect(speechSegments([0,0.9,0,0,0,0,0,0,0],1)).toEqual([]);
  expect(speechSegments(Array(32).fill(0.8),1)).toEqual([{start:0,end:1}]);
});
it('retains weak continuation only after speech meets the existing minimum span', () => {
  const probabilities = [...Array(5).fill(0.8), ...Array(6).fill(0.4), ...Array(8).fill(0)];
  expect(speechSegments(probabilities, 1)).toEqual([{start:0, end:0.352}]);
  // A strong transient must not promote a long ambiguous sound into speech.
  expect(speechSegments([0.9, ...Array(20).fill(0.4), ...Array(8).fill(0)], 1)).toEqual([]);
  expect(speechSegments([...Array(3).fill(0.9), ...Array(20).fill(0.4)], 1)).toEqual([]);
});
it('ends continuation after a quiet gap and clamps partial final frames to the recording', () => {
  expect(speechSegments([...Array(5).fill(0.8), ...Array(8).fill(0), ...Array(10).fill(0.4)], 1))
    .toEqual([{start:0, end:0.16}]);
  expect(speechSegments([...Array(5).fill(0.8), 0.4], 0.18)).toEqual([{start:0, end:0.18}]);
  expect(speechSegments([...Array(5).fill(0.8), ...Array(6).fill(0.34)], 1))
    .toEqual([{start:0, end:0.16}]);
});
it('returns unknown for weak or speech-dominated environmental predictions', () => {
  const scores = new Float32Array(521); scores[378]=0.2;
  expect(selectSoundHint(scores)).toBeNull();
  scores[378]=0.8; scores[0]=0.9;
  expect(selectSoundHint(scores)).toBeNull();
  scores[0]=0.1;
  expect(selectSoundHint(scores)?.label).toBe('Typing');
});
