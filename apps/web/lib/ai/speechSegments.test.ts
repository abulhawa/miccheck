import {expect,it} from 'vitest';
import {speechSegments} from './silero';
import {selectSoundHint} from './sounds';

it('ignores isolated speech spikes and preserves sustained speech', () => {
  expect(speechSegments([0,0.9,0,0,0,0,0,0,0],1)).toEqual([]);
  expect(speechSegments(Array(32).fill(0.8),1)).toEqual([{start:0,end:1}]);
});
it('returns unknown for weak or speech-dominated environmental predictions', () => {
  const scores = new Float32Array(521); scores[378]=0.2;
  expect(selectSoundHint(scores)).toBeNull();
  scores[378]=0.8; scores[0]=0.9;
  expect(selectSoundHint(scores)).toBeNull();
  scores[0]=0.1;
  expect(selectSoundHint(scores)?.label).toBe('Typing');
});
