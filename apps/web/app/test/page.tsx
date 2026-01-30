"use client";

import { useMemo } from "react";
import Link from "next/link";
import AudioVisualizer from "../../components/AudioVisualizer";
import ScoreCard from "../../components/ScoreCard";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";

export default function TestPage() {
  const {
    status,
    error,
    level,
    duration,
    analysis,
    initializeRecorder,
    startRecording,
    stopRecording,
    reset
  } = useAudioRecorder({ maxDuration: 7 });

  const confidenceValue = analysis?.recommendation.confidence ?? 0;
  const confidencePercent = Math.round(confidenceValue * 100);
  const confidenceLabel =
    confidenceValue >= 0.9
      ? "High confidence"
      : confidenceValue >= 0.75
        ? "Moderate confidence"
        : "Low confidence";

  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";
  const buttonLabel = useMemo(() => {
    if (isRecording) return "Stop recording";
    if (isAnalyzing) return "Analyzing...";
    return "Start recording";
  }, [isRecording, isAnalyzing]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">MicCheck Test</p>
          <h1 className="text-3xl font-semibold">Record a quick sample</h1>
          <p className="text-sm text-slate-300">
            We&apos;ll capture 5–7 seconds to analyze level, noise, and echo.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-6">
          <AudioVisualizer level={level} isRecording={isRecording} />
          <div className="flex flex-wrap items-center gap-4">
            <button
              className="rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-700"
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
          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {analysis ? (
        <section className="grid gap-6 md:grid-cols-2">
          <ScoreCard
            result={analysis}
            highlightedCategoryLabel={analysis.primaryIssueCategory}
          />
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold">Next steps</h2>
            <p className="mt-3 text-sm text-slate-300">{analysis?.recommendation.message}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Category focus: {analysis?.recommendation.category}</li>
              <li>
                Confidence:{" "}
                <span
                  title="Confidence reflects how clear the audio signal was for analysis."
                  data-confidence={confidencePercent}
                >
                  {confidenceLabel}
                </span>
              </li>
              <li>Keep your mouth 6-8 inches from the mic.</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                href="/results"
              >
                See sample results
              </Link>
              <button
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
                onClick={() => {
                  reset();
                  void initializeRecorder();
                }}
              >
                Test Again
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
          Your results will appear here after recording.
        </section>
      )}
    </div>
  );
}
