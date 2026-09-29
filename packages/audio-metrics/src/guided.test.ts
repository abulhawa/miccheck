import { describe, expect, it } from 'vitest';
import { analyzeGuidedSamples, type GuidedEvidence } from './guided';
import { measureEcho } from './metrics/echo';

const rate = 16000;
const context = {use_case: 'meetings' as const, device_type: 'usb_mic' as const, mode: 'basic' as const};
const evidence: GuidedEvidence = {quietSeconds: 2, speechDetection: 'silero', segments: [{start: 2, end: 5}], capture: {format:'pcm', echoCancellation:false,noiseSuppression:false,autoGainControl:false}};
function fixture(signalAmplitude = 0.1) {
  return Float32Array.from({length: rate * 5}, (_, i) => 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate) + (i >= 2 * rate ? signalAmplitude * Math.sin(2 * Math.PI * 300 * i / rate) : 0));
}
describe('guided evidence', () => {
  it('measures echo on contiguous original speech and preserves it when pauses change', () => {
    let seed = 12345;
    const source = Float32Array.from({length:rate}, () => {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
      return (seed / 4294967296 * 2 - 1) * 0.1;
    });
    const reflected = Float32Array.from(source, (x,i) => x + (i >= 1920 ? source[i-1920]*0.65 : 0));
    const expected = (measureEcho(source,rate).echoScore+measureEcho(reflected,rate).echoScore)/2;
    for (const pause of [0.3, 2, 5]) {
      const secondStart = 3 + pause;
      const samples = new Float32Array(Math.ceil((secondStart+2)*rate));
      samples.set(source,2*rate);
      samples.set(reflected,Math.round(secondStart*rate));
      const result = analyzeGuidedSamples(samples,rate,context,{...evidence,segments:[{start:2,end:3},{start:secondStart,end:secondStart+1}]});
      expect(result.metrics.echoScore).toBeCloseTo(expected,5);
      expect(result.evidence?.echoExperimental).toBe(true);
      expect(result.specialState).toBeUndefined();
    }
  });
  it('recovers known SNR from independent quiet and speech intervals', () => {
    const result = analyzeGuidedSamples(fixture(), rate, context, evidence);
    expect(result.metrics.snrDb).toBeCloseTo(20, 1);
    expect(result.evidence?.speechSeconds).toBe(3);
    expect(result.specialState).toBeUndefined();
  });
  it('withholds grading if speech contaminates calibration or the model fails', () => {
    const contaminated = analyzeGuidedSamples(fixture(), rate, context, {...evidence,segments:[{start:0,end:5}]});
    expect(contaminated.specialState).toBe('INSUFFICIENT_EVIDENCE');
    expect(analyzeGuidedSamples(fixture(), rate, context, {...evidence,speechDetection:'energy'}).specialState).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('does not claim detected speech for a negative neural result', () => {
    expect(analyzeGuidedSamples(fixture(), rate, context, {...evidence,segments:[]}).specialState).toBe('NO_SPEECH');
  });
  it('explains detected speech instead of reporting no speech', () => {
    const short = analyzeGuidedSamples(fixture(), rate, context, {...evidence, segments:[{start:2,end:2.5}]});
    expect(short.specialState).toBe('INSUFFICIENT_EVIDENCE');
    expect(short.evidence?.retryReason).toBe('speech_too_short');
    for (const segments of [[{start:0,end:5}], [{start:0,end:1}]]) {
      const early = analyzeGuidedSamples(fixture(), rate, context, {...evidence, segments});
      expect(early.specialState).toBe('INSUFFICIENT_EVIDENCE');
      expect(early.evidence?.retryReason).toBe('calibration_speech');
    }
    const unavailable = analyzeGuidedSamples(fixture(), rate, context, {...evidence, speechDetection:'energy'});
    expect(unavailable.evidence?.retryReason).toBe('speech_detection_unavailable');
    const silence = analyzeGuidedSamples(fixture(), rate, context, {...evidence, segments:[]});
    expect(silence.evidence?.retryReason).toBe('no_speech');
  });
  it('bases certainty on capture evidence, independently of grade', () => {
    for (const amplitude of [0.02,0.1,1.5]) {
      expect(analyzeGuidedSamples(fixture(amplitude),rate,context,evidence).verdict.diagnosticCertainty).toBe('low');
    }
    expect(analyzeGuidedSamples(fixture(),rate,context,{...evidence,capture:{format:'encoded'}}).verdict.diagnosticCertainty).toBe('low');
  });
  it('keeps speech clipping, total clipped duration, grade, and advice invariant when silence is appended', () => {
    const samples = fixture();
    samples.fill(1, rate * 3, rate * 3.1);
    const extended = new Float32Array(samples.length + rate * 10);
    extended.set(samples);
    const before = analyzeGuidedSamples(samples, rate, context, evidence);
    const after = analyzeGuidedSamples(extended, rate, context, evidence);
    expect(after.metrics.clippingRatio).toBe(before.metrics.clippingRatio);
    expect(after.metrics.speechClippingRatio).toBe(before.metrics.clippingRatio);
    expect(after.metrics.clippedDurationSeconds).toBeCloseTo(before.metrics.clippedDurationSeconds!, 10);
    // Calibration noise here is audible; digital silence is a real noise decrease.
    expect(after.specialState).toBe('INSUFFICIENT_EVIDENCE');
    const quiet = samples.slice();
    quiet.fill(0, 0, rate * 2);
    const quietExtended = new Float32Array(quiet.length + rate * 10);
    quietExtended.set(quiet);
    const a = analyzeGuidedSamples(quiet, rate, context, evidence);
    const b = analyzeGuidedSamples(quietExtended, rate, context, evidence);
    expect(b.verdict.overall.grade).toBe(a.verdict.overall.grade);
    expect(b.recommendation).toEqual(a.recommendation);
  });
  it('retains clipping outside detected speech, even when no speech is found', () => {
    const samples = fixture();
    samples.fill(1, 0, rate / 10);
    const result = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(result.metrics.clippingRatio).toBe(0);
    expect(result.metrics.clippedDurationSeconds).toBeCloseTo(0.1);
    expect(result.metrics.unselectedClippedDurationSeconds).toBe(0);
    const noSpeech = analyzeGuidedSamples(samples, rate, context, {...evidence, segments:[]});
    expect(noSpeech.metrics.clippingRatio).toBe(0);
    expect(noSpeech.metrics.clippedDurationSeconds).toBeCloseTo(0.1);
    expect(noSpeech.metrics.unselectedClippedDurationSeconds).toBe(0);
  });
  it.each([0.01, 0.04, 0.001])('assesses later noise amplitude %s independently of speech', amplitude => {
    const samples = new Float32Array(rate * 6);
    samples.set(fixture());
    for (let i = rate * 5; i < samples.length; i++) samples[i] = amplitude * Math.sin(2 * Math.PI * 3000 * i / rate);
    const result = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(result.evidence?.noiseStability).toBe(amplitude === 0.01 ? 'stable' : 'unstable');
    expect(result.specialState).toBe(amplitude === 0.01 ? undefined : 'INSUFFICIENT_EVIDENCE');
    expect(result.evidence?.retryReason).toBe(amplitude === 0.01 ? undefined : 'noise_unstable');
    if (amplitude === 0.01) expect(result.verdict.diagnosticCertainty).toBe('medium');
  });
  it('marks missing or too-short quiet intervals unassessed without forcing a retry', () => {
    const continuous = analyzeGuidedSamples(fixture(), rate, context, evidence);
    expect(continuous.evidence?.noiseStability).toBe('unassessed');
    expect(continuous.specialState).toBeUndefined();
    const short = new Float32Array(rate * 5.3);
    short.set(fixture());
    expect(analyzeGuidedSamples(short, rate, context, evidence).evidence?.noiseStability).toBe('unassessed');
  });
  it('does not combine separated short noise dips into a sustained decrease', () => {
    const samples = new Float32Array(8 * rate);
    for (let i = 0; i < samples.length; i++) {
      const dipped = (i >= 4.8 * rate && i < 5.05 * rate) || (i >= 5.8 * rate && i < 6.05 * rate);
      samples[i] = .02 * Math.SQRT2 * Math.sin(2 * Math.PI * 120 * i / rate) * (dipped ? 10 ** (-9 / 20) : 1);
      if (i >= 2 * rate && i < 4 * rate) samples[i] += .1 * Math.sin(2 * Math.PI * 200 * i / rate);
    }
    const result = analyzeGuidedSamples(samples, rate, context, {...evidence, segments: [{start: 2, end: 4}]});
    expect(result.evidence?.noiseStability).toBe('stable');
    expect(result.evidence?.maxNoiseChangeDb).toBeGreaterThan(6);
    expect(result.evidence?.retryReason).toBeUndefined();
    expect(result.specialState).toBeUndefined();
    // One genuinely sustained decrease still invalidates the calibration.
    samples.fill(0, Math.round(4.8 * rate), Math.round(5.4 * rate));
    const sustained = analyzeGuidedSamples(samples, rate, context, {...evidence, segments: [{start: 2, end: 4}]});
    expect(sustained.evidence?.retryReason).toBe('noise_unstable');
  });
  it('excludes speech-boundary residue and detects intermittent later noise', () => {
    const samples = new Float32Array(rate * 6);
    samples.set(fixture());
    for (let i = rate * 5; i < samples.length; i++) samples[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate);
    samples.fill(0.5, rate * 5, rate * 5.15);
    expect(analyzeGuidedSamples(samples, rate, context, evidence).evidence?.noiseStability).toBe('stable');
    samples.fill(0.1, rate * 5.5, rate * 5.8);
    expect(analyzeGuidedSamples(samples, rate, context, evidence).evidence?.noiseStability).toBe('unstable');
  });
  it('protects the brief-event detector from 280 ms speech tails and isolated spikes', () => {
    const samples = new Float32Array(rate * 6);
    samples.set(fixture());
    for (let i = rate * 5; i < samples.length; i++) samples[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate);
    samples.fill(0.1, rate * 5, rate * 5.28);
    samples.fill(0.5, rate * 5.6, rate * 5.61);
    expect(analyzeGuidedSamples(samples, rate, context, evidence).evidence?.noiseStability).toBe('stable');
  });
  it.each([0.5, 0.513, 0.527])('detects a 100 ms event at window phase %s', phase => {
    const samples = new Float32Array(rate * 6);
    samples.set(fixture());
    for (let i = rate * 5; i < samples.length; i++) samples[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate);
    samples.fill(0.1, Math.floor(rate * (5 + phase)), Math.floor(rate * (5.1 + phase)));
    const result = analyzeGuidedSamples(samples, rate, context, evidence);
    expect(result.evidence?.noiseStability).toBe('unstable');
    expect(result.evidence?.retryReason).toBe('noise_unstable');
  });
  it('does not interpret an isolated missed speech onset as a brief background event', () => {
    const samples = new Float32Array(rate * 6);
    for (let i = 0; i < samples.length; i++) samples[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate);
    samples.fill(0.1, rate * 2.35, rate * 2.45);
    samples.set(fixture().subarray(rate * 2), rate * 3);
    const result = analyzeGuidedSamples(samples,rate,context,{...evidence,segments:[{start:3,end:6}]});
    expect(result.evidence?.noiseStability).toBe('stable');
  });
  it('withholds a stability claim when an elevated event is cut off by capture end', () => {
    const samples = new Float32Array(Math.round(rate * 5.9));
    samples.set(fixture());
    for (let i = rate * 5; i < samples.length; i++) samples[i] = 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate);
    samples.fill(0.1, Math.round(rate * 5.76));
    const result = analyzeGuidedSamples(samples,rate,context,evidence);
    expect(result.evidence?.noiseStability).toBe('unassessed');
    expect(result.verdict.diagnosticCertainty).toBe('low');
    expect(result.specialState).toBeUndefined();
  });
});
