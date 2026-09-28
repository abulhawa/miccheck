import { computeRms } from '@miccheck/audio-core';
import { measureClipping } from './metrics/clipping';
import { measureLevel } from './metrics/level';
import { measureEcho } from './metrics/echo';
import { measureHum } from './metrics/hum';
import { getNoSpeechVerdict, getVerdict } from './scoring/verdict';
import { buildRecommendationPolicy, buildVerdictNextSteps, recommendFix } from './diagnosis/recommendations';
import type { AnalysisSummary, ContextInput } from './types';

export interface SpeechSegment { start: number; end: number }
export interface CaptureEvidence {
  format: 'pcm' | 'encoded';
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}
export interface GuidedEvidence {
  segments: SpeechSegment[];
  speechDetection: 'silero' | 'energy';
  quietSeconds: number;
  capture: CaptureEvidence;
}
export interface MeasurementEvidence {
  retryReason?: 'no_speech' | 'speech_too_short' | 'calibration_speech' | 'calibration_too_short' | 'speech_detection_unavailable' | 'noise_unstable';
  speechSeconds: number;
  quietSeconds: number;
  speechDetection: 'silero' | 'energy';
  capture: CaptureEvidence;
  noiseReliable: boolean;
  noiseStability?: 'stable' | 'unstable' | 'unassessed';
  laterNoiseSeconds?: number;
  maxNoiseChangeDb?: number;
  echoExperimental: true;
}

const db = (rms: number) => 20 * Math.log10(Math.max(rms, 1e-8));

/** Provisional stationarity check, not a calibrated uncertainty estimate. */
function assessNoiseStability(samples: Float32Array, mask: Uint8Array, quietEnd: number, rate: number, noiseFloor: number) {
  const guard = Math.ceil(rate * 0.2);
  const window = Math.max(1, Math.floor(rate * 0.25));
  // Ignore differences wholly below -60 dBFS, including appended digital silence.
  const referenceDb = db(Math.max(noiseFloor, 0.001));
  let windows = 0;
  let maxNoiseChangeDb = 0;
  let changedWindows = 0;
  for (let i = quietEnd; i < mask.length;) {
    if (mask[i]) { i++; continue; }
    const runStart = i;
    while (i < mask.length && !mask[i]) i++;
    const start = runStart + (runStart > quietEnd && mask[runStart - 1] ? guard : 0);
    const end = i - (i < mask.length ? guard : 0);
    if (end - start < window * 2) continue;
    for (let offset = start; offset + window <= end; offset += window) {
      const levelDb = db(Math.max(computeRms(samples.subarray(offset, offset + window)), 0.001));
      const changeDb = Math.abs(levelDb - referenceDb);
      maxNoiseChangeDb = Math.max(maxNoiseChangeDb, changeDb);
      if (changeDb > 6) changedWindows++;
      windows++;
    }
  }
  const laterNoiseSeconds = windows * window / rate;
  const noiseStability = laterNoiseSeconds < 0.5 ? 'unassessed' : changedWindows >= 2 ? 'unstable' : 'stable';
  return {noiseStability, laterNoiseSeconds, maxNoiseChangeDb} as const;
}

/** Guided quiet-then-speech measurements. Never infer noise from zero crossings. */
export function analyzeGuidedSamples(samples: Float32Array, sampleRate: number, context: ContextInput, input: GuidedEvidence): AnalysisSummary {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0 || samples.some((x) => !Number.isFinite(x))) throw new Error('Invalid PCM input');
  const duration = samples.length / sampleRate;
  const quietSeconds = Math.min(duration, Math.max(0, input.quietSeconds));
  const mask = new Uint8Array(samples.length);
  let calibrationSpeech = 0;
  for (const segment of input.segments) {
    if (!Number.isFinite(segment.start) || !Number.isFinite(segment.end)) continue;
    const start = Math.max(0, Math.floor(segment.start * sampleRate));
    const end = Math.min(samples.length, Math.ceil(segment.end * sampleRate));
    for (let i = start; i < end; i++) mask[i] = 1;
  }
  const quietEnd = Math.floor(quietSeconds * sampleRate);
  const speech: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    if (i < quietEnd) calibrationSpeech += mask[i];
    else if (mask[i]) speech.push(samples[i]);
  }
  const speechSamples = Float32Array.from(speech);
  const speechSeconds = speech.length / sampleRate;
  const noiseFloor = computeRms(samples.subarray(0, quietEnd));
  const calibrationReliable = quietSeconds >= 1 && calibrationSpeech / sampleRate < 0.15 && input.speechDetection === 'silero';
  const stability = assessNoiseStability(samples, mask, quietEnd, sampleRate, noiseFloor);
  const noiseReliable = calibrationReliable && stability.noiseStability !== 'unstable';
  const evidence: MeasurementEvidence = {speechSeconds, quietSeconds, speechDetection: input.speechDetection, capture: input.capture, noiseReliable, ...stability, echoExperimental: true};
  const speechRms = computeRms(speechSamples);
  // Speech intervals contain signal + background; subtract background power.
  const signalRms = Math.sqrt(Math.max(0, speechRms ** 2 - noiseFloor ** 2));
  const snrDb = signalRms > 0 ? Math.max(-20, Math.min(80, db(signalRms) - db(noiseFloor))) : -20;
  const humRatio = measureHum(samples.subarray(0, quietEnd), sampleRate);
  const clipping = measureClipping(speechSamples);
  const recordingClipping = measureClipping(samples);
  const echo = measureEcho(speechSamples, sampleRate);
  const metrics = {clippingRatio: clipping.clippingRatio, speechClippingRatio: clipping.clippingRatio,
    clippedDurationSeconds: recordingClipping.nearFullScaleSampleCount / sampleRate,
    clippingEventCount: recordingClipping.clippingEventCount,
    rmsDb: db(speechRms), speechRmsDb: db(speechRms), snrDb, humRatio, echoScore: echo.echoScore};
  if (speechSeconds < 1 || !noiseReliable) {
    const retryReason: MeasurementEvidence['retryReason'] = input.speechDetection !== 'silero'
      ? 'speech_detection_unavailable'
      : speechSeconds === 0 && calibrationSpeech === 0
        ? 'no_speech'
        : calibrationSpeech / sampleRate >= 0.15
          ? 'calibration_speech'
          : quietSeconds < 1
            ? 'calibration_too_short'
            : speechSeconds < 1 ? 'speech_too_short' : 'noise_unstable';
    evidence.retryReason = retryReason;
    const noSpeech = retryReason === 'no_speech';
    return {metrics, evidence, specialState: noSpeech ? 'NO_SPEECH' : 'INSUFFICIENT_EVIDENCE', verdict: {...getNoSpeechVerdict(context), diagnosticCertainty: 'low', bestNextSteps: []}, recommendation: {category: 'General', messageKey: 'recommendation.no_speech', confidence: 0}};
  }
  // Echo is experimental and cannot lower the grade or drive purchase advice.
  const gradingMetrics = {...metrics, echoScore: 0};
  const verdict = getVerdict(gradingMetrics, context);
  const level = measureLevel(speechSamples);
  const noise = {noiseFloor, snrDb, humRatio, confidence: 'medium' as const};
  const conservativeEcho = {echoScore: 0, confidence: 'low' as const};
  const policy = buildRecommendationPolicy(level, clipping, noise, conservativeEcho, context);
  verdict.useCaseFit = ['A', 'A-', 'B'].includes(verdict.overall.grade) ? 'pass' : verdict.overall.grade === 'C' ? 'warn' : 'fail';
  verdict.reassuranceMode = verdict.useCaseFit === 'pass';
  // Confidence describes evidence, never how good/bad the grade is. Until a real
  // device benchmark is published, even raw PCM findings are at most medium.
  verdict.diagnosticCertainty = stability.noiseStability === 'stable' && input.capture.format === 'pcm' && input.capture.echoCancellation === false && input.capture.noiseSuppression === false && input.capture.autoGainControl === false ? 'medium' : 'low';
  verdict.bestNextSteps = verdict.reassuranceMode ? [] : buildVerdictNextSteps(policy).filter((step) => step.kind === 'action');
  return {metrics, verdict, evidence, recommendation: recommendFix(level, clipping, noise, conservativeEcho, context)};
}
