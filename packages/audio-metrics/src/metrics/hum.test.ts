import { describe, expect, it } from 'vitest';
import { measureHum } from './hum';

const tone = (frequency: number, rate: number, seconds: number, amplitude = 0.1) =>
  Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => amplitude * Math.sin(2 * Math.PI * frequency * i / rate));

describe('mains hum energy', () => {
  it.each([50, 50.5, 51, 60, 61])('detects %s Hz without an off-by-one bin', (frequency) => {
    expect(measureHum(tone(frequency, 48000, 1), 48000)).toBeGreaterThan(0.98);
  });
  it.each([16000, 44100, 48000])('is bounded and duration independent at %s Hz', (rate) => {
    for (const seconds of [0.5, 1, 2.3, 7]) {
      const result = measureHum(tone(60, rate, seconds), rate);
      expect(result).toBeGreaterThan(0.98);
      expect(result).toBeLessThanOrEqual(1);
    }
  });
  it('measures the energy fraction in a known mixture', () => {
    const signal = tone(1000, 16000, 2, 0.2);
    const hum = tone(50, 16000, 2, 0.1);
    const mixed = signal.map((value, i) => value + hum[i]);
    expect(measureHum(mixed, 16000)).toBeCloseTo(0.2, 2);
    expect(measureHum(signal, 16000)).toBeLessThan(0.001);
  });
  it('does not interpret DC or silence as mains hum', () => {
    expect(measureHum(new Float32Array(16000).fill(0.1), 16000)).toBe(0);
    expect(measureHum(new Float32Array(16000), 16000)).toBe(0);
    expect(measureHum(new Float32Array(0), 16000)).toBe(0);
  });
});
