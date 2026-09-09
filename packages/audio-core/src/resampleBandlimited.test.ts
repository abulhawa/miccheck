import {expect,it} from 'vitest';
import {resampleBandlimited} from './resample';
import {computeRms} from './pcmUtils';
it('preserves speech-band amplitude and suppresses frequencies that would alias',()=>{
  const tone=(frequency:number)=>Float32Array.from({length:48000},(_,i)=>Math.sin(2*Math.PI*frequency*i/48000));
  const low=resampleBandlimited(tone(1000),48000,16000);
  const high=resampleBandlimited(tone(12000),48000,16000);
  expect(low.length).toBe(16000);
  expect(computeRms(low.subarray(100,-100))).toBeCloseTo(Math.SQRT1_2,2);
  expect(computeRms(high.subarray(100,-100))).toBeLessThan(0.001);
});
