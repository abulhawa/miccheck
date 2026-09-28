import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeRms } from '@miccheck/audio-core';
import { analyzeGuidedSamples } from '../src/guided';

const base = new URL('../../../apps/web/e2e/fixtures/reference-noise/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base), 'utf8'));
const rate = 16000;
function load(file: string): Float32Array {
  const metadata = manifest.clips.find((clip: {file: string}) => clip.file === file);
  const bytes = readFileSync(new URL(file, base));
  if (createHash('sha256').update(bytes).digest('hex') !== metadata.sha256) throw new Error(`Fixture checksum mismatch: ${file}`);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid WAV');
  let pcm: Buffer | undefined;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (offset + 8 + size > bytes.length) throw new Error('Truncated WAV');
    if (kind === 'fmt ') validFormat = size >= 16 && bytes.readUInt16LE(offset + 8) === 1 && bytes.readUInt16LE(offset + 10) === 1 && bytes.readUInt32LE(offset + 12) === rate && bytes.readUInt16LE(offset + 22) === 16;
    if (kind === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
  }
  if (!validFormat || !pcm || pcm.length !== metadata.samples * 2) throw new Error('Expected complete mono PCM16 reference at 16 kHz');
  return Float32Array.from({length: pcm.length / 2}, (_, i) => pcm!.readInt16LE(i * 2) / 32768);
}
const room = load('AirConditioner_1.wav').slice(0, rate * 2);
describe('independently labelled MS-SNSD mixtures', () => {
  for (const file of ['clnsp0.wav', 'clnsp1.wav']) {
    for (const targetDb of manifest.mixture_protocol.snr_db) {
      it(`${file}: recovers ${targetDb} dB SNR within 1 dB from retained reference components`, () => {
        const source = load(file);
        const sourceLength = Math.ceil(source.length / room.length) * room.length;
        const signal = new Float32Array(sourceLength);
        signal.set(source);
        const signalGain = manifest.mixture_protocol.signal_rms / computeRms(signal);
        const noiseGain = manifest.mixture_protocol.signal_rms / (10 ** (targetDb / 20) * computeRms(room));
        const noise = Float32Array.from(room, x => x * noiseGain);
        for (let i = 0; i < signal.length; i++) signal[i] *= signalGain;
        const samples = Float32Array.from({length: rate * 4 + sourceLength}, (_, i) => noise[i % noise.length] + (i >= rate * 2 && i < rate * 2 + sourceLength ? signal[i - rate * 2] : 0));
        // Reference interval is specified before analysis. It includes source
        // pauses/padding and is not a claim of manual human speech annotation.
        const referenceDb = 20 * Math.log10(computeRms(signal) / computeRms(noise));
        expect(referenceDb).toBeCloseTo(targetDb, 4);
        expect(samples.every(x => Math.abs(x) < 1)).toBe(true);
        const result = analyzeGuidedSamples(samples, rate, {use_case:'meetings',device_type:'unknown',mode:'basic'}, {
          quietSeconds: 2, speechDetection:'silero', segments:[{start:2,end:2+sourceLength/rate}],
          capture:{format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false}
        });
        expect(Math.abs(result.metrics.snrDb-referenceDb)).toBeLessThanOrEqual(manifest.mixture_protocol.max_snr_error_db);
        expect(result.evidence?.noiseStability).toBe('stable');
        expect(result.specialState).toBeUndefined();
      });
    }
  }
});
