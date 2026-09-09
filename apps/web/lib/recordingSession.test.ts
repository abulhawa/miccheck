// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {analyzeGuidedSamples} from '@miccheck/audio-metrics';
import {clearSession,saveSession,loadSession,comparableTakes,type RecordingSession} from './recordingSession';

function take(): RecordingSession {
  const rate=16000;
  const samples=Float32Array.from({length:rate*5},(_,i)=>i>=rate*2?0.1*Math.sin(i):0.0001*Math.sin(i));
  const analysis=analyzeGuidedSamples(samples,rate,{use_case:'meetings',device_type:'usb_mic',mode:'basic'},{segments:[{start:2,end:5}],quietSeconds:2,speechDetection:'silero',capture:{format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  return {id:'take-1',blob:new Blob(['audio'],{type:'audio/webm'}),analysis,deviceId:'mic-1',createdAt:Date.now()};
}
afterEach(()=>{vi.restoreAllMocks();clearSession();clearSession('baseline');sessionStorage.clear();});
it('persists audio and analysis in one record and restores the same take',async()=>{
  const session=take();expect(await saveSession(session)).toBe(true);
  const raw=sessionStorage.getItem('miccheck.session.v2.latest')!;
  clearSession();sessionStorage.setItem('miccheck.session.v2.latest',raw);
  const restored=loadSession();expect(restored?.id).toBe(session.id);expect(restored?.analysis).toEqual(session.analysis);expect(restored?.blob.size).toBe(5);
});
it('keeps only memory when storage fails and never revives a cleared pending save',async()=>{
  const session=take();vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota');});
  expect(await saveSession(session)).toBe(false);expect(loadSession()).toBe(session);
  const pending=saveSession(session);clearSession();await pending;expect(loadSession()).toBeNull();
});
it('refuses corrupt records and mismatched settings for comparison',()=>{
  sessionStorage.setItem('miccheck.session.v2.latest','{"version":2,"analysis":{}}');expect(loadSession()).toBeNull();
  const before=take();const after=take();expect(comparableTakes(before,after)).toBe(true);
  after.deviceId='another mic';expect(comparableTakes(before,after)).toBe(false);
});
