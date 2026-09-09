import type { AnalysisResult } from '../types';
import { readStorage, writeStorage } from './safeStorage';

type Slot = 'latest' | 'baseline';
export interface RecordingSession {id: string; analysis: AnalysisResult; blob: Blob; deviceId: string | null; createdAt: number}
const memory: Partial<Record<Slot,RecordingSession>> = {};
const generations: Record<Slot,number> = {latest:0,baseline:0};
const key = (slot: Slot) => `miccheck.session.v2.${slot}`;

export function clearSession(slot: Slot = 'latest') {
  generations[slot]++;
  delete memory[slot];
  writeStorage('sessionStorage',key(slot),null);
}

export async function saveSession(session: RecordingSession, slot: Slot = 'latest'): Promise<boolean> {
  const request = ++generations[slot];
  memory[slot] = session;
  try {
    const audio = await new Promise<string>((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid audio'));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(session.blob);
    });
    if (request !== generations[slot]) return false;
    // One atomic storage value binds scores and audio to the same take.
    return writeStorage('sessionStorage',key(slot),JSON.stringify({...session,blob:undefined,audio,version:2}));
  } catch {return false;}
}

export function loadSession(slot: Slot = 'latest'): RecordingSession | null {
  if (memory[slot]) return memory[slot];
  const raw = readStorage('sessionStorage',key(slot));
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    if (saved.version !== 2 || typeof saved.id !== 'string' || !Number.isFinite(saved.createdAt) || Date.now()-saved.createdAt > 24*60*60*1000 || typeof saved.audio !== 'string' || !validAnalysis(saved.analysis)) return null;
    const match = /^data:(audio\/[\w;+.= -]+);base64,([\s\S]+)$/.exec(saved.audio);
    if (!match) return null;
    const bytes = Uint8Array.from(atob(match[2]),(char)=>char.charCodeAt(0));
    const session: RecordingSession = {id:saved.id,createdAt:saved.createdAt,analysis:saved.analysis,blob:new Blob([bytes],{type:match[1]}),deviceId:typeof saved.deviceId === 'string' ? saved.deviceId : null};
    memory[slot] = session;
    return session;
  } catch {return null;}
}

function validAnalysis(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as AnalysisResult;
  if (!result.metrics || !['clippingRatio','rmsDb','speechRmsDb','snrDb','humRatio','echoScore'].every((key)=>Number.isFinite(result.metrics[key as keyof typeof result.metrics]))) return false;
  if (!result.verdict?.copyKeys || !result.verdict.overall || !['A','A-','B','C','D','F'].includes(result.verdict.overall.grade)) return false;
  if (!['level','noise','echo'].every((key)=>{
    const category = result.verdict.dimensions?.[key as 'level'];
    return category && Number.isFinite(category.stars) && category.stars >= 0 && category.stars <= 5 && typeof category.descriptionKey === 'string';
  })) return false;
  if (result.evidence && (!Number.isFinite(result.evidence.speechSeconds) || !Number.isFinite(result.evidence.quietSeconds) || !result.evidence.capture)) return false;
  if (result.ai && (!Array.isArray(result.ai.segments) || !result.ai.segments.every((segment)=>Number.isFinite(segment.start)&&Number.isFinite(segment.end)))) return false;
  return true;
}

export function comparableTakes(before: RecordingSession, after: RecordingSession): boolean {
  const a = before.analysis.evidence;
  const b = after.analysis.evidence;
  return !before.analysis.specialState && !after.analysis.specialState && !!a && !!b && before.deviceId === after.deviceId && before.analysis.verdict.context?.use_case === after.analysis.verdict.context?.use_case && a.speechDetection === b.speechDetection && a.noiseReliable && b.noiseReliable && a.capture.format === b.capture.format && ['echoCancellation','noiseSuppression','autoGainControl'].every((key)=>a.capture[key as 'echoCancellation'] === false && b.capture[key as 'echoCancellation'] === false);
}
