// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';
import { createPcmCapture } from '../lib/pcmCapture';
import { analyzeLocally } from '../lib/localAnalysis';

vi.mock('@miccheck/audio-core', () => ({describeBrowserSupport:()=>({isSupported:true,issues:[]})}));
vi.mock('../lib/pcmCapture', () => ({createPcmCapture:vi.fn()}));
vi.mock('../lib/localAnalysis', () => ({analyzeLocally:vi.fn()}));
vi.mock('../lib/recordingSession', () => ({loadSession:()=>null,clearSession:vi.fn(),saveSession:vi.fn()}));

afterEach(() => {vi.unstubAllGlobals();vi.clearAllMocks();vi.useRealTimers();});

async function setup(encoded = false) {
  vi.useFakeTimers();
  const room = new Float32Array(300).fill(0.01);
  const voice = new Float32Array(2000).fill(0.2);
  const finish = vi.fn().mockResolvedValueOnce(room).mockResolvedValueOnce(voice);
  const capture = {start:vi.fn(),finish,dispose:vi.fn()};
  vi.mocked(createPcmCapture).mockResolvedValue(encoded ? null : capture);
  vi.mocked(analyzeLocally).mockResolvedValue({evidence:{noiseReliable:true},verdict:{useCaseFit:'pass'},metrics:{}} as never);
  const track = {stop:vi.fn(),readyState:'live',addEventListener:vi.fn(),getSettings:()=>({echoCancellation:false,noiseSuppression:false,autoGainControl:false})};
  track.stop.mockImplementation(()=>{track.readyState='ended';});
  const getUserMedia = vi.fn(async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]}));
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});
  const decode = vi.fn().mockResolvedValueOnce({duration:3,sampleRate:100,getChannelData:()=>room}).mockResolvedValueOnce({duration:20,sampleRate:100,getChannelData:()=>voice});
  vi.stubGlobal('AudioContext',class {
    sampleRate=100;
    resume=vi.fn(); close=vi.fn(); decodeAudioData=decode;
    createMediaStreamSource=()=>({connect:vi.fn(),disconnect:vi.fn()});
    createAnalyser=()=>({fftSize:16,getFloatTimeDomainData:vi.fn(),disconnect:vi.fn()});
  });
  vi.stubGlobal('requestAnimationFrame',vi.fn());
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  const starts = vi.fn();
  vi.stubGlobal('MediaRecorder',class {
    static isTypeSupported=()=>true;
    state='inactive'; mimeType='audio/webm';
    onstop:(()=>void)|null=null;
    ondataavailable:((event:{data:Blob})=>void)|null=null;
    start(){this.state='recording';starts();}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['audio'])});this.onstop?.();}
  });
  // Avoid FileReader timing in fake-timer tests; decoder and PCM fixtures carry the audio.
  vi.stubGlobal('Blob', NodeBlob);
  let current!:ReturnType<typeof useAudioRecorder>;
  function Harness(){const value=useAudioRecorder({staged:true,maxDuration:20,minDuration:3});React.useEffect(()=>{current=value;});return null;}
  const root=createRoot(document.createElement('div'));
  await act(async()=>root.render(<Harness/>));
  return {get current(){return current;},root,room,voice,track,starts,getUserMedia,capture};
}

it.each([false,true])('waits for the user and excludes preparation audio (encoded=%s)',async(encoded)=>{
  const h=await setup(encoded);
  try {
    await act(async()=>h.current.startRecording());
    expect(h.starts).not.toHaveBeenCalled();
    await act(async()=>h.current.startCalibration());
    expect(h.current.status).toBe('calibrating');
    await act(async()=>vi.advanceTimersByTimeAsync(3000));
    expect(h.current.status).toBe('ready');
    expect(h.track.stop).not.toHaveBeenCalled();
    await act(async()=>vi.advanceTimersByTimeAsync(45000));
    expect(h.current.status).toBe('ready');
    expect(h.starts).toHaveBeenCalledTimes(1);
    await act(async()=>h.current.startRecording());
    await act(async()=>vi.advanceTimersByTimeAsync(19000));
    expect(h.current.status).toBe('recording');
    await act(async()=>vi.advanceTimersByTimeAsync(1000));
    expect(h.current.status).toBe('complete');
    expect(h.getUserMedia).toHaveBeenCalledOnce();
    expect(h.track.stop).toHaveBeenCalledOnce();
    const args=vi.mocked(analyzeLocally).mock.calls[1];
    expect(args[0].length).toBe(2300);
    expect(args[0].slice(0,300)).toEqual(h.room);
    expect(args[0].slice(300)).toEqual(h.voice);
    expect(args[7]).toBe(3);
    expect(args[3].format).toBe(encoded ? 'encoded' : 'pcm');
    expect(h.current.recordingBlob?.type).toBe('audio/wav');
  } finally {await act(async()=>h.root.unmount());vi.restoreAllMocks();}
});

it('releases the microphone and discards calibration when cancelled while ready',async()=>{
  const h=await setup();
  try {
    await act(async()=>h.current.startCalibration());
    await act(async()=>vi.advanceTimersByTimeAsync(3000));
    await act(async()=>h.current.reset());
    expect(h.current.status).toBe('idle');
    expect(h.track.stop).toHaveBeenCalledOnce();
    await act(async()=>h.current.startRecording());
    expect(h.starts).toHaveBeenCalledTimes(1);
  } finally {await act(async()=>h.root.unmount());vi.restoreAllMocks();}
});

it('rejects speech in the room check before asking the user to record a passage',async()=>{
  const h=await setup();
  vi.mocked(analyzeLocally).mockResolvedValue({evidence:{noiseReliable:false}} as never);
  try {
    await act(async()=>h.current.startCalibration());
    await act(async()=>vi.advanceTimersByTimeAsync(3000));
    expect(h.current.status).toBe('error');
    expect(h.current.error).toContain('Speech was detected during the room check');
    expect(h.track.stop).toHaveBeenCalledOnce();
  } finally {await act(async()=>h.root.unmount());vi.restoreAllMocks();}
});
