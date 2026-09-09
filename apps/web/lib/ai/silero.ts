import * as ort from 'onnxruntime-web/wasm';
import type { SpeechSegment } from '@miccheck/audio-metrics';

/** Silero v5 expects a 512-sample frame, 64 samples of context, and recurrent state. */
export async function detectSpeech(samples16k: Float32Array, assetBase: string): Promise<SpeechSegment[]> {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = `${assetBase}/runtime/`;
  const session = await ort.InferenceSession.create(`${assetBase}/silero/silero_vad_v5.onnx`, {executionProviders:['wasm']});
  let state: ort.Tensor = new ort.Tensor('float32', new Float32Array(2 * 128), [2,1,128]);
  let context = new Float32Array(64);
  const probabilities: number[] = [];
  try {
    for (let start = 0; start < samples16k.length; start += 512) {
      const frame = new Float32Array(576);
      frame.set(context);
      frame.set(samples16k.subarray(start, start + 512), 64);
      const input = new ort.Tensor('float32', frame, [1,576]);
      const sr = new ort.Tensor('int64', BigInt64Array.from([16000n]), []);
      const result = await session.run({input, state, sr});
      probabilities.push(Number(result.output.data[0]));
      state.dispose(); input.dispose(); sr.dispose(); result.output.dispose();
      state = result.stateN;
      context = frame.slice(-64);
    }
  } finally {state.dispose(); await session.release();}
  return speechSegments(probabilities, samples16k.length / 16000);
}

export function speechSegments(probabilities: number[], duration: number): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let start: number | null = null;
  let lastVoice = 0;
  for (let i = 0; i <= probabilities.length; i++) {
    const time = i * 0.032;
    if ((probabilities[i] ?? 0) >= 0.5) {
      if (start === null) start = time;
      lastVoice = Math.min(duration, time + 0.032);
    }
    if (start !== null && (time - lastVoice >= 0.16 || i === probabilities.length)) {
      if (lastVoice - start >= 0.16) segments.push({start, end:lastVoice});
      start = null;
    }
  }
  return segments;
}
