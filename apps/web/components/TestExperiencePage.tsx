"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AudioPlayer from "./AudioPlayer";
import AudioWaveformVisualizer from "./AudioWaveformVisualizer";
import DeviceSelector from "./DeviceSelector";
import ScoreCard from "./ScoreCard";
import BestNextSteps from "./BestNextSteps";
import ResultsNotice from "./ResultsNotice";
import { useAudioMeter } from "../hooks/useAudioMeter";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import {
  ANALYSIS_CONTEXT_OPTIONS,
  formatDeviceTypeLabel,
  formatUseCaseLabel,
  loadAnalysisContext,
  saveAnalysisContext
} from "../lib/analysisContextStorage";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import { resolveNoSpeechCopy } from "../lib/copy";
import type { DeviceType, UseCase } from "../types";

const DEVICE_OVERRIDE_STORAGE_KEY = "miccheck.analysis.deviceOverride.v1";
const VIEW_MODE_STORAGE_KEY = "miccheck.view.mode.v1";

type ViewMode = "basic" | "pro";

interface TestExperiencePageProps {
  viewMode: ViewMode;
}

export default function TestExperiencePage({ viewMode }: TestExperiencePageProps) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [useCase, setUseCase] = useState<UseCase>("meetings");
  const [detectedDeviceType, setDetectedDeviceType] = useState<DeviceType>("unknown");
  const [deviceTypeOverride, setDeviceTypeOverride] = useState<DeviceType | null>(null);
  const hasShownIOSAlert = useRef(false);
  const [deviceRefreshSignal, setDeviceRefreshSignal] = useState("0");

  const resolvedDeviceType = deviceTypeOverride ?? detectedDeviceType;
  const analysisContext = useMemo(
    () => ({ use_case: viewMode === "basic" ? "meetings" : useCase, device_type: resolvedDeviceType, mode: viewMode }),
    [resolvedDeviceType, useCase, viewMode]
  );

  const {
    status,
    error,
    duration,
    mediaStream,
    recordingBlob,
    analysis,
    startRecording,
    stopRecording,
    reset
  } = useAudioRecorder({ maxDuration: 7, deviceId, analysisContext });

  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";

  const { audioDataArray, currentVolume, peakVolume } = useAudioMeter({
    stream: mediaStream,
    isActive: isRecording
  });

  useEffect(() => {
    const storedContext = loadAnalysisContext();
    setUseCase(storedContext.use_case);

    const storedOverride = window.localStorage.getItem(DEVICE_OVERRIDE_STORAGE_KEY);
    if (storedOverride) {
      setDeviceTypeOverride(storedOverride as DeviceType);
    }

    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    saveAnalysisContext({ use_case: useCase, device_type: "unknown", mode: viewMode });
  }, [useCase, viewMode]);

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

  useEffect(() => {
    if (status === "recording") {
      setDeviceRefreshSignal((current) => `${Number(current) + 1}`);
    }
  }, [status]);

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
    },
    []
  );

  const handleTestAgain = useCallback(() => {
    const shownAdviceCount = analysis
      ? (analysis.verdict.reassuranceMode
          ? 0
          : analysis.verdict.bestNextSteps?.filter((step) => step.kind === "action").length ?? 0)
      : 0;

    logEvent(ANALYTICS_EVENTS.reRecordClicked, {
      mode: viewMode,
      fromReassurance: Boolean(analysis?.verdict.reassuranceMode),
      adviceCount: viewMode === "basic" ? Math.min(shownAdviceCount, 1) : shownAdviceCount
    });

    reset();
  }, [analysis, reset, viewMode]);

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
          <div className="flex gap-3 text-xs font-semibold">
            <Link
              className={viewMode === "basic" ? "text-white underline" : "text-slate-300"}
              href="/test"
            >
              Basic view
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              className={viewMode === "pro" ? "text-white underline" : "text-slate-300"}
              href="/pro"
            >
              Pro view
            </Link>
          </div>

          <AudioWaveformVisualizer
            audioDataArray={audioDataArray}
            currentVolume={currentVolume}
            peakVolume={peakVolume}
            isRecording={isRecording}
          />

          <div className="flex flex-wrap items-center gap-4">
            <button
              className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-700"
              disabled={isAnalyzing}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {buttonLabel}
            </button>
            <button
              className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              disabled={isRecording}
              onClick={reset}
            >
              Reset
            </button>
            <div className="text-sm text-slate-400">Duration: {duration.toFixed(1)}s</div>
          </div>

          <DeviceSelector onDeviceChange={handleDeviceChange} refreshSignal={deviceRefreshSignal} />
          <p className="text-xs text-slate-400">Detected device type: {formatDeviceTypeLabel(detectedDeviceType)}</p>

          {viewMode === "pro" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Use case
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                  onChange={(event) => setUseCase(event.target.value as UseCase)}
                  value={useCase}
                >
                  {ANALYSIS_CONTEXT_OPTIONS.useCases.map((nextUseCase) => (
                    <option key={nextUseCase} value={nextUseCase}>
                      {formatUseCaseLabel(nextUseCase)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-300">
                Device type
                <select
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                  onChange={(event) =>
                    setDeviceTypeOverride(
                      event.target.value === "auto" ? null : (event.target.value as DeviceType)
                    )
                  }
                  value={deviceTypeOverride ?? "auto"}
                >
                  <option value="auto">Auto ({formatDeviceTypeLabel(resolvedDeviceType)})</option>
                  {ANALYSIS_CONTEXT_OPTIONS.deviceTypes.map((deviceType) => (
                    <option key={deviceType} value={deviceType}>
                      {formatDeviceTypeLabel(deviceType)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
        </div>
      </section>

      {analysis ? (
        <>
          <ResultsNotice
            diagnosticCertainty={analysis.verdict.diagnosticCertainty}
            specialState={analysis.specialState}
          />

          {analysis.specialState === "NO_SPEECH" ? (
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
                Test again
              </button>
            </section>
          ) : (
            <section className="grid gap-6 md:grid-cols-2">
              <ScoreCard
                highlightedCategoryId={analysis.verdict.primaryIssue}
                metrics={analysis.metrics}
                verdict={analysis.verdict}
              />
              <BestNextSteps
                includeGear={viewMode === "pro"}
                includeSecondaryNotes={viewMode === "pro"}
                maxActionSteps={viewMode === "basic" ? 1 : undefined}
                mode={viewMode}
                showDiagnosticCertainty={viewMode === "pro"}
                verdict={analysis.verdict}
              />
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
                    Test again
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-sm text-slate-400">
          Your results will appear here after recording.
        </section>
      )}

      {recordingBlob ? <AudioPlayer audioBlob={recordingBlob} showWaveform={true} /> : null}
    </div>
  );
}
