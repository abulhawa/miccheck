import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const folder = path.join(root, 'apps/web/e2e/fixtures/human-speech');
const input = process.argv[2] ?? 'annotations.ai.json';
const output = process.argv[3] ?? 'annotations-review.html';
if (path.basename(input) !== input || path.basename(output) !== output) throw new Error('Use fixture filenames only');
const annotations = JSON.parse(fs.readFileSync(path.join(folder, input), 'utf8'));
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards = annotations.clips.map((clip, index) => `<section aria-labelledby="clip-${index}">
<h2 id="clip-${index}">${escape(clip.file)}</h2>
<audio id="audio-${index}" controls preload="none" src="${escape(clip.file)}">Your browser cannot play this FLAC recording.</audio>
<p>Speaker ${escape(clip.speaker)} · ${clip.durationSeconds}s · transcript WER ${clip.transcriptWer} · source noise: unknown</p>
<p><strong>Flags:</strong> ${clip.reviewFlags.map(escape).join(', ')}</p>
<div class="timeline" aria-label="Provisional annotation timeline">${clip.intervals.map(interval => `<button class="${interval.label}" style="flex:${interval.end - interval.start}" data-audio="audio-${index}" data-start="${interval.start}" aria-label="${interval.label}, ${interval.start.toFixed(3)} to ${interval.end.toFixed(3)} seconds" title="${interval.label}: ${interval.start.toFixed(3)}–${interval.end.toFixed(3)}s"></button>`).join('')}</div>
<p>Provisional seconds: speech ${clip.secondsByLabel.speech}; nonspeech ${clip.secondsByLabel.nonspeech}; uncertain ${clip.secondsByLabel.uncertain}.</p>
<p><strong>Upstream transcript:</strong> ${escape(clip.referenceTranscript)}</p>
<p><strong>Model transcript:</strong> ${escape(clip.recognizedTranscript)}</p>
<details><summary>Inspect word timestamps and model probabilities</summary><table><thead><tr><th>Word</th><th>Start (s)</th><th>End (s)</th><th>Model probability</th></tr></thead><tbody>${clip.words.map(word => `<tr><td>${escape(word.text)}</td><td>${word.start.toFixed(3)}</td><td>${word.end.toFixed(3)}</td><td>${Number.isFinite(word.probability) ? word.probability.toFixed(3) : 'Not supplied by Groq'}</td></tr>`).join('')}</tbody></table></details>
</section>`).join('\n');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Provisional speech annotation review</title>
<style>body{font:16px system-ui;max-width:1000px;margin:2rem auto;padding:0 1rem;color:#17212b;background:#f6f8fa}section{background:white;border:1px solid #ccd3db;border-radius:8px;padding:1rem;margin:1rem 0}audio{width:100%}.timeline{display:flex;height:42px;width:100%;overflow:hidden;border:1px solid #596674}.timeline button{border:0;min-width:0;padding:0;cursor:pointer}.speech{background:#24805b}.nonspeech{background:#4277aa}.uncertain{background:#e5b948}.timeline button:focus-visible{outline:3px solid #111;outline-offset:-3px}table{border-collapse:collapse;width:100%}td,th{padding:.3rem;text-align:left;border-bottom:1px solid #ccd3db}.legend span{padding:.3rem;color:#fff}.legend .uncertain{color:#111}</style>
<h1>Provisional speech annotation review</h1><p>AI-assisted signal labels; no human listening review has been performed. These labels are independent of Miccheck's detector but are not ground truth. Source noise events are unknown. Model probabilities are not calibrated confidence.</p>
${annotations.protocol.refinement ? `<p><strong>Groq Large V3 consensus:</strong> ${escape(annotations.protocol.refinement)} Related Whisper models can share errors. Raw provider timestamps may exceed source duration; flagged words do not support speech labels.</p>` : ''}
<p>Listen to each recording and inspect uncertain regions. Click or keyboard-activate a colored interval to seek the recording to its start, then use the audio controls to play. Timeline positions use original source time. Word boundaries are model estimates.</p>
<p class="legend"><span class="speech">Speech candidate</span> <span class="nonspeech">Nonspeech candidate</span> <span class="uncertain">Uncertain / excluded</span></p>${cards}
<script>document.querySelectorAll('[data-audio]').forEach(button=>button.addEventListener('click',()=>{const audio=document.getElementById(button.dataset.audio);audio.currentTime=Number(button.dataset.start);audio.focus();}));</script></html>`;
fs.writeFileSync(path.join(folder, output), html);
console.log(`Generated ${output} from frozen source annotations.`);
