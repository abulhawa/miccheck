export interface PcmCapture {
  start(): void;
  finish(): Promise<Float32Array | null>;
  dispose(): void;
}

export async function createPcmCapture(context: AudioContext, source: MediaStreamAudioSourceNode): Promise<PcmCapture | null> {
  if (!context.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  await context.audioWorklet.addModule('/audio-capture.js');
  const node = new AudioWorkletNode(context, 'miccheck-capture');
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(node);
  node.connect(mute);
  mute.connect(context.destination);
  let chunks: Float32Array[] = [];
  let length = 0;
  let complete: ((samples: Float32Array | null) => void) | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  node.port.onmessage = ({data}: MessageEvent<{samples?: Float32Array; done?: boolean}>) => {
    if (disposed) return;
    if (data.samples) {
      // Bound memory even when background-tab timers are throttled.
      if (length + data.samples.length <= context.sampleRate * 15) {
        chunks.push(data.samples);
        length += data.samples.length;
      }
    }
    if (data.done && complete) {
      const samples = new Float32Array(length);
      let offset = 0;
      for (const chunk of chunks) {samples.set(chunk, offset); offset += chunk.length;}
      clearTimeout(timeout);
      complete(samples.length ? samples : null);
      complete = null;
      chunks = [];
    }
  };
  return {
    start() {chunks = []; length = 0; node.port.postMessage('start');},
    finish() {
      if (disposed) return Promise.resolve(null);
      return new Promise((resolve) => {
        complete = resolve;
        node.port.postMessage('stop');
        timeout = setTimeout(() => {complete?.(null); complete = null;}, 1000);
      });
    },
    dispose() {
      disposed = true;
      clearTimeout(timeout);
      complete?.(null);
      complete = null;
      chunks = [];
      node.port.close();
      node.disconnect();
      mute.disconnect();
    }
  };
}
