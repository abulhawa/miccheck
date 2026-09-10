import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Actual recorded human speech, decoded and analyzed by the production worker.
// No supplied speech segments, mocked probabilities, or model substitutions.
for (const fixture of ['6930-75918-0000.flac', '6930-75918-0007.flac']) {
  for (const scenario of ['clean', 'quiet', 'early'] as const) {
    test(`human speech ${fixture}: ${scenario}`, async ({ page }) => {
      await page.goto('/test');
      const encoded = readFileSync(path.resolve('e2e/fixtures', fixture)).toString('base64');
      const result = await page.evaluate(async ({ encoded, scenario }) => {
        const ctx = new AudioContext({sampleRate:16000});
        const audio = await ctx.decodeAudioData(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)).buffer);
        const voice = audio.getChannelData(0);
        const offset = scenario === 'early' ? 0 : 2 * 16000;
        const samples = new Float32Array(offset + voice.length);
        for (let i = 0; i < voice.length; i++) samples[offset + i] = voice[i] * (scenario === 'quiet' ? 0.1 : 1);
        await ctx.close();
        return await new Promise<{
          specialState?: string;
          evidence: {speechSeconds:number; noiseReliable:boolean; retryReason?:string};
          ai: {segments:{start:number;end:number}[]};
        }>((resolve,reject) => {
          const worker = new Worker('/audio-analysis.worker.js', {type:'module'});
          const timeout = setTimeout(() => {worker.terminate();reject(new Error('Speech analysis timed out'));},30000);
          const finish = () => {clearTimeout(timeout);worker.terminate();};
          worker.onerror = () => {finish();reject(new Error('Speech worker failed'));};
          worker.onmessage = ({data}) => {
            if (data.result) {finish();resolve(data.result);}
            if (data.error) {finish();reject(new Error(data.error));}
          };
          worker.postMessage({samples,sampleRate:16000,context:{use_case:'meetings',device_type:'unknown',mode:'basic'},capture:{format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false},classifyNoise:false});
        });
      }, {encoded, scenario});
      expect(result.ai.segments.length).toBeGreaterThan(0);
      if (scenario === 'early') {
        expect(result.specialState).toBe('INSUFFICIENT_EVIDENCE');
        expect(result.evidence.retryReason).toBe('calibration_speech');
        expect(result.evidence.noiseReliable).toBe(false);
        await page.evaluate(({result,encoded}) => {
          sessionStorage.setItem('miccheck.session.v2.latest', JSON.stringify({
            version:2, id:'human-speech-regression', createdAt:Date.now(), deviceId:null,
            analysis:result, audio:`data:audio/flac;base64,${encoded}`,
          }));
        }, {result,encoded});
        await page.reload();
        await expect(page.getByRole('heading', {name:'Speech detected during room calibration'})).toBeVisible();
        await expect(page.getByText('No speech detected', {exact:true})).toHaveCount(0);
      } else {
        expect(result.specialState).toBeUndefined();
        expect(result.evidence.speechSeconds).toBeGreaterThanOrEqual(1);
        expect(result.evidence.noiseReliable).toBe(true);
      }
    });
  }
}
