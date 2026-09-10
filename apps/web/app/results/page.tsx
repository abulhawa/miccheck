"use client";

import React, {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import AudioPlayer from '../../components/AudioPlayer';
import ScoreCard from '../../components/ScoreCard';
import BestNextSteps from '../../components/BestNextSteps';
import {buttonStyles} from '../../components/buttonStyles';
import {analyzeLocally} from '../../lib/localAnalysis';
import {makeDemoSamples,pcmWav,type DemoKind} from '../../lib/demoAudio';
import type {AnalysisResult} from '../../types';

const examples: {kind:DemoKind;title:string;description:string}[] = [
  {kind:'clean',title:'Clean speech',description:'A quiet background and a comfortable speech level.'},
  {kind:'noisy',title:'Background noise',description:'The same voice mixed with deterministic broadband noise.'},
  {kind:'clipped',title:'Too much gain',description:'The voice amplified until peaks are clipped.'},
  {kind:'reverberant',title:'Room reflections',description:'A delayed copy of the voice. Echo remains experimental.'},
];

export default function ResultsPage() {
  const [result,setResult] = useState<{analysis:AnalysisResult;blob:Blob;title:string}|null>(null);
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const controller = useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);

  async function runExample(example: typeof examples[number]) {
    controller.current?.abort();
    const abort = new AbortController();controller.current=abort;
    setBusy(true);setError('');setResult(null);setStatus('Preparing synthetic speech…');
    let audioContext: AudioContext|null=null;
    try {
      audioContext = new AudioContext({sampleRate:16000});
      const response = await fetch('/demo/speech.wav',{signal:abort.signal});
      if (!response.ok) throw new Error('Demo audio is unavailable. Please retry.');
      const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
      if (abort.signal.aborted) return;
      const samples = makeDemoSamples(buffer.getChannelData(0),example.kind,buffer.sampleRate);
      const analysis = await analyzeLocally(samples,buffer.sampleRate,{use_case:'meetings',device_type:'unknown',mode:'basic'},{format:'pcm',echoCancellation:false,noiseSuppression:false,autoGainControl:false},false,abort.signal,setStatus);
      if(!abort.signal.aborted) setResult({analysis,blob:pcmWav(samples,buffer.sampleRate),title:example.title});
    } catch(cause) {if(!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Demo could not run.');}
    finally {await audioContext?.close();if(!abort.signal.aborted) setBusy(false);}
  }

  return <div className="mx-auto flex max-w-4xl flex-col gap-6">
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">Interactive demo</p>
      <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Hear the problem. See the evidence.</h1>
      <p className="mt-3 max-w-2xl text-slate-300">Try the actual local AI pipeline with synthetic speech. Each result is computed from the audio you hear. No microphone permission needed.</p>
    </section>
    <div className="grid gap-3 sm:grid-cols-2">
      {examples.map((example)=><button key={example.kind} disabled={busy} onClick={()=>void runExample(example)} className="rounded-2xl border border-slate-700 bg-slate-900/50 p-5 text-left transition hover:border-sky-400 disabled:opacity-50">
        <span className="font-semibold">{example.title}</span><span className="mt-2 block text-sm text-slate-400">{example.description}</span>
      </button>)}
    </div>
    {busy ? <div role="status" className="text-sky-200">{status} <button className="ml-3 underline" onClick={()=>{controller.current?.abort();setBusy(false);}}>Cancel</button></div> : null}
    {error ? <p role="alert" className="text-rose-300">{error}</p> : null}
    {result ? <section className="flex flex-col gap-4" aria-label="Demo result">
      <h2 className="text-xl font-semibold">{result.title} · synthetic example</h2>
      {result.analysis.specialState ? <p>Not enough speech evidence was detected. Try another example.</p> : <>
        <ScoreCard verdict={result.analysis.verdict} metrics={result.analysis.metrics} experimentalEcho showShare={false}/>
        <BestNextSteps verdict={result.analysis.verdict} mode="basic" maxActionSteps={1} includeGear={false} trackAdviceEvent={false}/>
      </>}
      <AudioPlayer audioBlob={result.blob} showWaveform />
      <p className="text-xs text-slate-400">Silero detected {result.analysis.evidence?.speechSeconds.toFixed(1)} seconds of speech. This controlled example demonstrates behavior; it does not establish accuracy on real microphones.</p>
    </section> : null}
    <Link href="/test" className={buttonStyles({variant:'primary',className:'self-start'})}>Test my microphone</Link>
  </div>;
}
