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

export function pcmWav(samples: Float32Array, rate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset:number,value:string) => [...value].forEach((char,i)=>view.setUint8(offset+i,char.charCodeAt(0)));
  text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
  view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  text(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((sample,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,sample))*32767),true));
  return new Blob([buffer],{type:'audio/wav'});
}
