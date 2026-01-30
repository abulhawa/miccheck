"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import ScoreCard from "../../components/ScoreCard";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import type { AnalysisResult } from "../../types";

const sampleResult: AnalysisResult = {
  grade: "B",
  summary: "Strong overall sound with mild echo reflections.",
  categories: {
    level: { stars: 4, label: "Level", description: "Healthy speaking level" },
    noise: { stars: 5, label: "Noise", description: "Quiet background" },
    echo: { stars: 3, label: "Echo", description: "Some room echo" }
  },
  metrics: {
    clippingRatio: 0.003,
    rmsDb: -16.5,
    snrDb: 26.2,
    humRatio: 0.04,
    echoScore: 0.32
  },
  primaryIssueCategory: "Echo",
  primaryIssueExplanation: "Your grade is mainly affected by Echo",
  recommendation: {
    category: "Echo",
    message: "Add soft furnishings or move closer to the mic to reduce echo.",
    confidence: 0.78
  }
};

export default function ResultsPage() {
  const router = useRouter();
  const { reset, initializeRecorder } = useAudioRecorder({ maxDuration: 7 });

  const handleTestAgain = useCallback(() => {
    reset();
    router.push("/test");
    void initializeRecorder();
  }, [initializeRecorder, reset, router]);

  const isNoSpeech = sampleResult.specialState === "NO_SPEECH";
  const noSpeechFix = sampleResult.primaryFix ?? {
    title: "No clear speech detected",
    description: "Please speak closer to the microphone or check if your mic is muted.",
    priority: "critical" as const
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-3xl font-semibold">Sample results</h1>
        <p className="mt-2 text-sm text-slate-300">
          This is a preview of the insights you&apos;ll receive after recording.
        </p>
      </section>

      {isNoSpeech ? (
        <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
              No speech detected
            </p>
            <h2 className="text-2xl font-semibold text-white">{noSpeechFix.title}</h2>
            <p className="text-sm text-rose-100">{noSpeechFix.description}</p>
          </div>
          <button
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            onClick={handleTestAgain}
            type="button"
          >
            Test Again
          </button>
        </section>
      ) : (
        <>
          <ScoreCard
            result={sampleResult}
            highlightedCategoryLabel={sampleResult.primaryIssueCategory}
          />

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            <h2 className="text-lg font-semibold">What the metrics mean</h2>
            <ul className="mt-3 space-y-2">
              <li>
                Level: target around -14 dBFS, acceptable range roughly -26 to -6
                dBFS.
              </li>
              <li>Noise: higher SNR means a cleaner background.</li>
              <li>Echo: echo score rises with reflections or large rooms.</li>
            </ul>
            <button
              className="mt-6 inline-flex rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
              onClick={handleTestAgain}
              type="button"
            >
              Test Again
            </button>
          </section>
        </>
      )}
    </div>
  );
}
