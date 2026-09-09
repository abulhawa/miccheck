import { afterEach, expect, it, vi } from 'vitest';
import { createPcmCapture } from './pcmCapture';

afterEach(() => vi.unstubAllGlobals());

it('flushes PCM chunks in order and releases the worklet', async () => {
  let node!: {port: {onmessage: ((event: {data: unknown}) => void) | null; postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>}; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>};
  vi.stubGlobal('AudioWorkletNode', class {
    port = {onmessage: null, postMessage: vi.fn(), close: vi.fn()};
    connect = vi.fn(); disconnect = vi.fn();
    constructor() { node = this; }
  });
  const mute = {gain:{value:1},connect:vi.fn(),disconnect:vi.fn()};
  const context = {audioWorklet:{addModule:vi.fn().mockResolvedValue(undefined)},createGain:()=>mute,sampleRate:16000,destination:{}} as unknown as AudioContext;
  const capture = await createPcmCapture(context, {connect:vi.fn()} as unknown as MediaStreamAudioSourceNode);
  capture!.start();
  node.port.onmessage!({data:{samples:new Float32Array([0.1,0.2])}});
  node.port.onmessage!({data:{samples:new Float32Array([0.3])}});
  const finish = capture!.finish();
  node.port.onmessage!({data:{done:true}});
  expect(await finish).toEqual(new Float32Array([0.1,0.2,0.3]));
  expect(mute.gain.value).toBe(0);
  capture!.dispose();
  expect(node.port.close).toHaveBeenCalledOnce();
  expect(node.disconnect).toHaveBeenCalledOnce();
});

it('settles pending capture when cancelled', async () => {
  vi.stubGlobal('AudioWorkletNode', class {
    port = {onmessage:null, postMessage:vi.fn(), close:vi.fn()};
    connect = vi.fn(); disconnect = vi.fn();
  });
  const context = {audioWorklet:{addModule:vi.fn()},createGain:()=>({gain:{value:1},connect:vi.fn(),disconnect:vi.fn()}),sampleRate:16000} as unknown as AudioContext;
  const capture = await createPcmCapture(context,{connect:vi.fn()} as unknown as MediaStreamAudioSourceNode);
  const finish = capture!.finish(); capture!.dispose();
  expect(await finish).toBeNull();
});
