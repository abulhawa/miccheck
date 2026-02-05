"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeviceType } from "../../types";
import Link from "next/link";
import AudioPlayer from "../../components/AudioPlayer";
import AudioWaveformVisualizer from "../../components/AudioWaveformVisualizer";
import DeviceSelector from "../../components/DeviceSelector";
import ScoreCard from "../../components/ScoreCard";
import BestNextSteps from "../../components/BestNextSteps";
import { useAudioMeter } from "../../hooks/useAudioMeter";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { ANALYTICS_EVENTS, logEvent } from "../../lib/analytics";
import {
  ANALYSIS_CONTEXT_OPTIONS,
  getDefaultAnalysisContext,
  loadAnalysisContext,
  saveAnalysisContext
} from "../../lib/analysisContextStorage";
import { resolveNoSpeechCopy } from "../../lib/copy";

const DEVICE_OVERRIDE_STORAGE_KEY = "miccheck.analysis.deviceOverride.v1";

export default function TestPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [analysisContext, setAnalysisContext] = useState(getDefaultAnalysisContext());
  const [detectedDeviceType, setDetectedDeviceType] = useState<DeviceType>("unknown");
  const [deviceTypeOverride, setDeviceTypeOverride] = useState<DeviceType | null>(null);
  const hasShownIOSAlert = useRef(false);
  const resolvedDeviceType = deviceTypeOverride ?? detectedDeviceType;
  const resolvedAnalysisContext = { ...analysisContext, device_type: resolvedDeviceType };

  const {
    status,
    error,
    duration,
    mediaStream,
    recordingBlob,
    analysis,
    initializeRecorder,
    startRecording,
    stopRecording,
    reset
  } = useAudioRecorder({ maxDuration: 7, deviceId, analysisContext: resolvedAnalysisContext });
  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";
  const { audioDataArray, currentVolume, peakVolume } = useAudioMeter({
    stream: mediaStream,
    isActive: isRecording
  });

  useEffect(() => {
    setAnalysisContext(loadAnalysisContext());
    const storedOverride = window.localStorage.getItem(DEVICE_OVERRIDE_STORAGE_KEY);
    if (storedOverride) {
      setDeviceTypeOverride(storedOverride as DeviceType);
    }
  }, []);

  useEffect(() => {
    saveAnalysisContext(analysisContext);
  }, [analysisContext]);


  useEffect(() => {
    if (deviceTypeOverride) {
      window.localStorage.setItem(DEVICE_OVERRIDE_STORAGE_KEY, deviceTypeOverride);
      return;
    }
    window.localStorage.removeItem(DEVICE_OVERRIDE_STORAGE_KEY);
  }, [deviceTypeOverride]);
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !hasShownIOSAlert.current) {
      hasShownIOSAlert.current = true;
      window.alert("For best results, use Chrome on iOS.");
    }
  }, []);

  const noSpeechCopy = analysis
    ? resolveNoSpeechCopy(analysis.verdict.copyKeys)
    : { title: "", description: "" };

  const buttonLabel = useMemo(() => {
    if (isRecording) return "Stop recording";
    if (isAnalyzing) return "Analyzing...";
    return "Start recording";
  }, [isRecording, isAnalyzing]);

  const handleDeviceChange = useCallback(
    (nextDeviceId: string | null, meta?: { detectedType: DeviceType }) => {
      setDeviceId(nextDeviceId);
      setDetectedDeviceType(meta?.detectedType ?? "unknown");
      void initializeRecorder(nextDeviceId);
    },
    [initializeRecorder]
  );

  const handleTestAgain = useCallback(() => {
    logEvent(ANALYTICS_EVENTS.testAgain);
    reset();
    void initializeRecorder();
  }, [initializeRecorder, reset]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-200">MicCheck Test</p>
          <h1 className="text-3xl font-semibold">Record a quick sample</h1>
          <p className="text-sm text-slate-200">
            We&apos;ll capture 5–7 seconds to analyze level, noise, and echo.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-6">
          <AudioWaveformVisualizer
            audioDataArray={audioDataArray}
            currentVolume={currentVolume}
            peakVolume={peakVolume}
            isRecording={isRecording}
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-700"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
            >
              {buttonLabel}
            </button>
            <button
              className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              onClick={reset}
              disabled={isRecording}
            >
              Reset
            </button>
            <div className="text-sm text-slate-400">Duration: {duration.toFixed(1)}s</div>
          </div>
          <DeviceSelector onDeviceChange={handleDeviceChange} />
          <p className="text-xs text-slate-400">Detected device type: {detectedDeviceType}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Use case
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                value={analysisContext.use_case}
                onChange={(event) =>
                  setAnalysisContext((current) => ({
                    ...current,
                    use_case: event.target.value as typeof current.use_case
                  }))
                }
              >
                {ANALYSIS_CONTEXT_OPTIONS.useCases.map((useCase) => (
                  <option key={useCase} value={useCase}>
                    {useCase}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Device type
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                value={deviceTypeOverride ?? "auto"}
                onChange={(event) =>
                  setDeviceTypeOverride(event.target.value === "auto" ? null : (event.target.value as DeviceType))
                }
              >
                <option value="auto">auto ({resolvedDeviceType})</option>
                {ANALYSIS_CONTEXT_OPTIONS.deviceTypes.map((deviceType) => (
                  <option key={deviceType} value={deviceType}>
                    {deviceType}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              Mode
              <select
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                value={analysisContext.mode}
                onChange={(event) =>
                  setAnalysisContext((current) => ({
                    ...current,
                    mode: event.target.value as typeof current.mode
                  }))
                }
              >
                {ANALYSIS_CONTEXT_OPTIONS.modes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {analysis ? (
        analysis.specialState === "NO_SPEECH" ? (
          <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
                🎤❌ No speech detected
              </p>
              <h2 className="text-2xl font-semibold text-white">{noSpeechCopy.title}</h2>
              <p className="text-sm text-rose-100">{noSpeechCopy.description}</p>
            </div>
            <button
              className="mt-6 inline-flex w-full justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              onClick={handleTestAgain}
              type="button"
            >
              Test Again
            </button>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2">
            <ScoreCard
              verdict={analysis.verdict}
              metrics={analysis.metrics}
              highlightedCategoryId={analysis.verdict.primaryIssue}
            />
            <BestNextSteps verdict={analysis.verdict} />
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  href="/results"
                >
                  See sample results
                </Link>
                <button
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
                  onClick={handleTestAgain}
                >
                  Test Again
                </button>
              </div>
            </div>
          </section>
        )
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
          Your results will appear here after recording.
        </section>
      )}

      {recordingBlob ? <AudioPlayer audioBlob={recordingBlob} showWaveform={true} /> : null}
    </div>
  );
}
