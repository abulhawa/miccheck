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
  const guard = Math.ceil(rate * 0.3);
  const window = Math.max(1, Math.floor(rate * 0.25));
  const eventWindow = Math.max(1, Math.floor(rate * 0.05));
  const eventHop = Math.max(1, Math.round(rate * 0.025));
  // Quantize the nominal 100 ms coverage on the window/hop grid itself.
  // At 22.05 kHz, 50 ms + two 25 ms hops is 2204 samples, not 2205.
  const eventCoverage = eventWindow + 2 * eventHop;
  // Ignore differences wholly below -60 dBFS, including appended digital silence.
  // For rises reaching that floor, compare against actual calibration: flooring
  // the reference too would hide a -70 to -58 dBFS increase.
  const referenceDb = db(Math.max(noiseFloor, 0.001));
  const changeFromCalibration = (rms: number) => db(rms) > -60 && rms > noiseFloor
    ? db(rms) - db(noiseFloor)
    : db(Math.max(rms, 0.001)) - referenceDb;
  let windows = 0;
  let maxNoiseChangeDb = 0;
  let changedWindows = 0;
  let briefNoiseEvent = false;
  let unfinishedNoiseEvent = false;
  for (let i = quietEnd; i < mask.length;) {
    if (mask[i]) { i++; continue; }
    const runStart = i;
    while (i < mask.length && !mask[i]) i++;
    const start = runStart + (runStart > quietEnd && mask[runStart - 1] ? guard : 0);
    const end = i - (i < mask.length ? guard : 0);
    // A brief burst can fit inside one 250 ms window and be missed by the
    // sustained-change rule. Require 100 ms of overlapping 50 ms evidence.
    // Reset at every speech/quiet boundary so disjoint spikes cannot accumulate.
    // Use a wider guard for short windows: weak speech and breaths may extend
    // beyond Silero's boundaries, especially at the end of an utterance.
    const eventGuard = Math.ceil(rate * 0.5);
    const eventStart = runStart + (runStart > quietEnd && mask[runStart - 1] ? eventGuard : 0);
    const eventEnd = i - (i < mask.length ? eventGuard : 0);
    let elevatedStart = -1;
    let eventHasEvidence = false;
    let elevatedHops = 0;
    let eventHasCoverage = false;
    // The leading voice interval can contain a soft onset missed by VAD.
    // Reserve this sensitive check for pauses following detected speech.
    for (let offset = eventStart; runStart > quietEnd && offset + eventWindow <= eventEnd; offset += eventHop) {
      const increaseDb = changeFromCalibration(computeRms(samples.subarray(offset, offset + eventWindow)));
      // Overlapping windows can count the same 10 ms spike three times.
      // Corroborate duration with disjoint hop-sized intervals; a 100 ms
      // event contains at least three full hops regardless of onset phase.
      const hopIncreaseDb = changeFromCalibration(computeRms(samples.subarray(offset, offset + eventHop)));
      elevatedHops = hopIncreaseDb > 6 ? elevatedHops + 1 : 0;
      // A recovery window can average the elevated first hop with quiet audio.
      // Preserve coverage when that hop still corroborates the event duration.
      if (elevatedStart >= 0 && elevatedHops >= 3 && offset + eventWindow - elevatedStart >= eventCoverage) eventHasCoverage = true;
      if (eventHasCoverage && elevatedHops >= 3) eventHasEvidence = true;
      maxNoiseChangeDb = Math.max(maxNoiseChangeDb, Math.abs(increaseDb));
      if (increaseDb > 6) {
        if (elevatedStart < 0) elevatedStart = offset;
        if (offset + eventWindow - elevatedStart >= eventCoverage) eventHasCoverage = true;
        if (eventHasCoverage && elevatedHops >= 3) eventHasEvidence = true;
      } else {
        // A completed burst needs a return to the room level. Otherwise a
        // truncated utterance at capture end can look like a noise event.
        if (eventHasEvidence) briefNoiseEvent = true;
        elevatedStart = -1;
        eventHasEvidence = false;
        eventHasCoverage = false;
      }
    }
    if (eventHasEvidence) unfinishedNoiseEvent = true;
    // Lack of sustained evidence cannot erase a completed brief event. Keep
    // short runs out of the sustained assessment and its usable-time count.
    if (end - start < window * 2) continue;
    for (let offset = start; offset + window <= end; offset += window) {
      const changeDb = Math.abs(changeFromCalibration(computeRms(samples.subarray(offset, offset + window))));
      maxNoiseChangeDb = Math.max(maxNoiseChangeDb, changeDb);
      // A loud spike can contaminate two adjacent 250 ms windows. Corroborate
      // each candidate independently so residue elsewhere cannot support it.
      if (changeDb > 6) {
        let changedHops = 0;
        for (let hop = offset; hop + eventHop <= offset + window; hop += eventHop) {
          const hopChangeDb = Math.abs(changeFromCalibration(computeRms(samples.subarray(hop, hop + eventHop))));
          changedHops = hopChangeDb > 6 ? changedHops + 1 : 0;
          if (changedHops >= 3) { changedWindows++; break; }
        }
      }
      windows++;
    }
  }
  const laterNoiseSeconds = windows * window / rate;
  const noiseStability = changedWindows >= 2 || briefNoiseEvent ? 'unstable' : laterNoiseSeconds < 0.5 || unfinishedNoiseEvent ? 'unassessed' : 'stable';
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
  // Preserve original timing: concatenating speech across pauses creates
  // artificial autocorrelation pairs. Average eligible contiguous runs by
  // sample count; short runs with no full 200 ms lag contribute no evidence.
  let echoWeightedScore = 0;
  let echoSamples = 0;
  for (let i = quietEnd; i < mask.length;) {
    if (!mask[i]) { i++; continue; }
    const start = i;
    while (i < mask.length && mask[i]) i++;
    if (i - start <= Math.floor(sampleRate * 0.2)) continue;
    echoWeightedScore += measureEcho(samples.subarray(start, i), sampleRate).echoScore * (i - start);
    echoSamples += i - start;
  }
  const metrics = {clippingRatio: clipping.clippingRatio, speechClippingRatio: clipping.clippingRatio,
    clippedDurationSeconds: recordingClipping.nearFullScaleSampleCount / sampleRate,
    clippingEventCount: recordingClipping.clippingEventCount,
    rmsDb: db(speechRms), speechRmsDb: db(speechRms), snrDb, humRatio, echoScore: echoSamples ? echoWeightedScore / echoSamples : 0};
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
