import {expect,it} from 'vitest';
import {makeDemoSamples,pcmWav} from './demoAudio';

it('builds deterministic examples with a quiet calibration interval',()=>{
  const speech=Float32Array.from({length:80000},(_,i)=>0.2*Math.sin(i/10));
  const clean=makeDemoSamples(speech,'clean');
  const noisy=makeDemoSamples(speech,'noisy');
  const clipped=makeDemoSamples(speech,'clipped');
  expect(clean).toEqual(makeDemoSamples(speech,'clean'));
  expect(Math.max(...clean.subarray(0,32000))).toBeLessThan(0.001);
  expect(Math.max(...noisy.subarray(0,32000))).toBeGreaterThan(0.06);
  expect(clipped.some((x)=>Math.abs(x)===1)).toBe(true);
  expect(clean.length).toBe(112000);
});
it('encodes the same samples as a playable 16-bit mono WAV',async()=>{
  const blob=pcmWav(new Float32Array([-1,0,1]),16000);
  const bytes=await blob.arrayBuffer();const view=new DataView(bytes);
  expect(blob.type).toBe('audio/wav');
  expect(view.getUint32(24,true)).toBe(16000);
  expect(view.getUint32(40,true)).toBe(6);
  expect(view.getInt16(44,true)).toBe(-32767);
  expect(view.getInt16(48,true)).toBe(32767);
});
