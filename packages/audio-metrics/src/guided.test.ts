import { describe, expect, it } from 'vitest';
import { analyzeGuidedSamples, type GuidedEvidence } from './guided';

const rate = 16000;
const context = {use_case: 'meetings' as const, device_type: 'usb_mic' as const, mode: 'basic' as const};
const evidence: GuidedEvidence = {quietSeconds: 2, speechDetection: 'silero', segments: [{start: 2, end: 5}], capture: {format:'pcm', echoCancellation:false,noiseSuppression:false,autoGainControl:false}};
function fixture(signalAmplitude = 0.1) {
  return Float32Array.from({length: rate * 5}, (_, i) => 0.01 * Math.sin(2 * Math.PI * 3000 * i / rate) + (i >= 2 * rate ? signalAmplitude * Math.sin(2 * Math.PI * 300 * i / rate) : 0));
}
describe('guided evidence', () => {
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
      expect(analyzeGuidedSamples(fixture(amplitude),rate,context,evidence).verdict.diagnosticCertainty).toBe('medium');
    }
    expect(analyzeGuidedSamples(fixture(),rate,context,{...evidence,capture:{format:'encoded'}}).verdict.diagnosticCertainty).toBe('low');
  });
});
