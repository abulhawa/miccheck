import type { CaptureEvidence, ContextInput } from '@miccheck/audio-metrics';
import type { AnalysisResult } from '../types';

export function analyzeLocally(samples: Float32Array, sampleRate: number, context: ContextInput, capture: CaptureEvidence, classifyNoise: boolean, signal: AbortSignal, onStatus: (status: string) => void, quietSeconds = 2): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {reject(new DOMException('Cancelled','AbortError')); return;}
    const worker = new Worker('/audio-analysis.worker.js', {type:'module'});
    const finish = () => {clearTimeout(timeout); signal.removeEventListener('abort',abort); worker.terminate();};
    const abort = () => {finish(); reject(new DOMException('Cancelled','AbortError'));};
    const timeout = setTimeout(() => {finish();reject(new Error('Local analysis timed out. Try a shorter recording or another browser.'));}, 60000);
    signal.addEventListener('abort',abort,{once:true});
    worker.onmessage = ({data}) => {
      if (data.status) onStatus(data.status);
      if (data.result) {finish();resolve(data.result);}
      if (data.error) {finish();reject(new Error(data.error));}
    };
    worker.onerror = () => {finish();reject(new Error('Local analysis is unavailable in this browser. Try Chrome or Edge.'));};
    const copy = samples.slice();
    worker.postMessage({samples:copy,sampleRate,context,capture,classifyNoise,quietSeconds},[copy.buffer]);
  });
}
