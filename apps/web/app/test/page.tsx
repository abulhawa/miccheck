"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AudioPlayer from "../../components/AudioPlayer";
import AudioWaveformVisualizer from "../../components/AudioWaveformVisualizer";
import AffiliateRecommendation from "../../components/AffiliateRecommendation";
import DeviceSelector from "../../components/DeviceSelector";
import ScoreCard from "../../components/ScoreCard";
import { useAudioMeter } from "../../hooks/useAudioMeter";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { ANALYTICS_EVENTS, logEvent } from "../../lib/analytics";
import { resolveCopy } from "../../lib/copy";

export default function TestPage() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const hasShownIOSAlert = useRef(false);
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
  } = useAudioRecorder({ maxDuration: 7, deviceId });
  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";
  const { audioDataArray, currentVolume, peakVolume } = useAudioMeter({
    stream: mediaStream,
    isActive: isRecording
  });

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !hasShownIOSAlert.current) {
      hasShownIOSAlert.current = true;
      window.alert("For best results, use Chrome on iOS.");
    }
  }, []);

  const confidenceValue = analysis?.recommendation.confidence ?? 0;
  const confidencePercent = Math.round(confidenceValue * 100);
  const confidenceLabel =
    confidenceValue >= 0.9
      ? "High confidence"
      : confidenceValue >= 0.75
        ? "Moderate confidence"
        : "Low confidence";

  const buttonLabel = useMemo(() => {
    if (isRecording) return "Stop recording";
    if (isAnalyzing) return "Analyzing...";
    return "Start recording";
  }, [isRecording, isAnalyzing]);

  const handleDeviceChange = useCallback(
    (nextDeviceId: string | null) => {
      setDeviceId(nextDeviceId);
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
            <div className="text-sm text-slate-400">
              Duration: {duration.toFixed(1)}s
            </div>
          </div>
          <DeviceSelector onDeviceChange={handleDeviceChange} />
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
              <h2 className="text-2xl font-semibold text-white">
                {analysis.verdict.copyKeys.noSpeechTitleKey
                  ? resolveCopy(analysis.verdict.copyKeys.noSpeechTitleKey)
                  : "No clear speech detected"}
              </h2>
              <p className="text-sm text-rose-100">
                {analysis.verdict.copyKeys.noSpeechDescriptionKey
                  ? resolveCopy(analysis.verdict.copyKeys.noSpeechDescriptionKey)
                  : "Please speak closer to the microphone or check if your mic is muted."}
              </p>
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
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-lg font-semibold">🎯 Your Top Fix</h2>
              <p className="mt-3 text-sm text-slate-200">
                {resolveCopy(analysis.verdict.copyKeys.fixKey)}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-400">
                <li>
                  Category focus:{" "}
                  {analysis.verdict.primaryIssue
                    ? resolveCopy(
                        analysis.verdict.dimensions[analysis.verdict.primaryIssue].labelKey
                      )
                    : resolveCopy(analysis.verdict.copyKeys.impactKey)}
                </li>
                <li>
                  Confidence:{" "}
                  <span
                    title="Confidence reflects how clear the audio signal was for analysis."
                    data-confidence={confidencePercent}
                  >
                    {confidenceLabel}
                  </span>
                </li>
              </ul>
              <AffiliateRecommendation issueCategory={analysis.verdict.primaryIssue ?? "level"} />
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

      {recordingBlob ? (
        <AudioPlayer audioBlob={recordingBlob} showWaveform={true} />
      ) : null}
    </div>
  );
}
