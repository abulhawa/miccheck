"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AudioPlayer from "../../components/AudioPlayer";
import ScoreCard from "../../components/ScoreCard";
import Tooltip from "../../components/Tooltip";
import { clearRecording, loadRecording } from "../../lib/audioStorage";
import { resolveNoSpeechCopy } from "../../lib/copy";
import type { AnalysisResult } from "../../types";
import { analysisDisplayThresholds } from "../../lib/domain/analysisDisplay";
import {
  STORAGE_SYNC_MAX_ATTEMPTS,
  STORAGE_SYNC_RETRY_DELAY_MS
} from "../../src/domain/recording/constants";

const sampleResult: AnalysisResult = {
  verdict: {
    version: "1.0",
    overall: {
      grade: "B",
      labelKey: "overall.label.good",
      summaryKey: "overall.summary.strong"
    },
    dimensions: {
      level: { stars: 4, labelKey: "category.level", descriptionKey: "level.slightly_off_target" },
      noise: { stars: 5, labelKey: "category.noise", descriptionKey: "noise.very_clean" },
      echo: { stars: 3, labelKey: "category.echo", descriptionKey: "echo.some_room_echo" }
    },
    primaryIssue: "echo",
    copyKeys: {
      explanationKey: "explanation.strong_echo",
      fixKey: "fix.add_soft_furnishings_move_closer",
      impactKey: "impact.echo",
      impactSummaryKey: "impact.biggest_opportunity"
    }
  },
  metrics: {
    clippingRatio: 0.003,
    rmsDb: -16.5,
    speechRmsDb: -15.2,
    snrDb: 26.2,
    humRatio: 0.04,
    echoScore: 0.32
  },
  recommendation: {
    category: "Echo",
    messageKey: "recommendation.reduce_echo",
    confidence: 0.78
  }
};

export default function ResultsPage() {
  const router = useRouter();
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const handleTestAgain = useCallback(() => {
    clearRecording();
    router.push("/test");
  }, [router]);

  useEffect(() => {
    let attempts = 0;
    let timeoutId: number | null = null;
    const maxAttempts = STORAGE_SYNC_MAX_ATTEMPTS;
    const retryDelay = STORAGE_SYNC_RETRY_DELAY_MS;

    const syncRecording = () => {
      const stored = loadRecording();
      if (stored) {
        setRecordingBlob(stored);
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        timeoutId = window.setTimeout(syncRecording, retryDelay);
      }
    };

    syncRecording();

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const isNoSpeech = sampleResult.specialState === "NO_SPEECH";
  const noSpeechCopy = resolveNoSpeechCopy(sampleResult.verdict.copyKeys);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-3xl font-semibold">Sample results</h1>
        <p className="mt-2 text-sm text-slate-200">
          This is a preview of the insights you&apos;ll receive after recording.
        </p>
      </section>

      {isNoSpeech ? (
        <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
              No speech detected
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
        <>
          <ScoreCard
            verdict={sampleResult.verdict}
            metrics={sampleResult.metrics}
            highlightedCategoryId={sampleResult.verdict.primaryIssue}
          />

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-200">
            <h2 className="text-lg font-semibold">What the metrics mean</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Tooltip
                  label="Level"
                  text={`Target around ${analysisDisplayThresholds.levelTargetDbfs} dBFS keeps speech clear without clipping.`}
                />
                : target around {analysisDisplayThresholds.levelTargetDbfs} dBFS, acceptable range roughly {analysisDisplayThresholds.levelAcceptableMinDbfs} to {analysisDisplayThresholds.levelAcceptableMaxDbfs} dBFS.
              </li>
              <li>
                Noise: higher{" "}
                <Tooltip
                  label="SNR"
                  text={`SNR > ${analysisDisplayThresholds.snrCleanThresholdDb}dB means your voice is ${analysisDisplayThresholds.snrCleanLoudnessRatio}x louder than background noise.`}
                />{" "}
                means a cleaner background.
              </li>
              <li>
                <Tooltip
                  label="Echo"
                  text="Echo score rises when room reflections are strong or the mic is far away."
                />
                : echo score rises with reflections or large rooms.
              </li>
            </ul>
            <button
              className="mt-6 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
              onClick={handleTestAgain}
              type="button"
            >
              Test Again
            </button>
          </section>

          {recordingBlob ? (
            <AudioPlayer audioBlob={recordingBlob} showWaveform={true} />
          ) : (
            <section className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
              Record a sample to unlock playback on this page.
            </section>
          )}
        </>
      )}
    </div>
  );
}
