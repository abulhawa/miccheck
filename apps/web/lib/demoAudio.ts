export type DemoKind = 'clean' | 'noisy' | 'clipped' | 'reverberant';

export function makeDemoSamples(speech: Float32Array, kind: DemoKind, rate = 16000): Float32Array {
  const samples = new Float32Array(rate * 7);
  const delay = Math.floor(rate * 0.12);
  let seed = 12345;
  for (let i=0;i<samples.length;i++) {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    const noise = (seed / 4294967296 * 2 - 1) * (kind === 'noisy' ? 0.065 : 0.0008);
    const position = i - rate * 2;
    const voice = position >= 0 ? speech[position] ?? 0 : 0;
    const reflected = kind === 'reverberant' && position >= delay ? (speech[position-delay] ?? 0)*0.65 : 0;
    samples[i] = Math.max(-1,Math.min(1,voice * (kind === 'clipped' ? 12 : 1) + noise + reflected));
  }
  return samples;
}

export { pcmWav } from "./wavEncoding";
