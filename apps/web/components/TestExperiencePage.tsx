"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { t } from "../lib/i18n";
import { buttonStyles } from "./buttonStyles";
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
  const [trackSettingsSnapshot, setTrackSettingsSnapshot] = useState<MediaTrackSettings | null>(null);
  const [audioContextSnapshot, setAudioContextSnapshot] = useState<{
    sampleRate?: number;
    baseLatency?: number;
    outputLatency?: number;
  } | null>(null);

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
    audioContext,
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

  useEffect(() => {
    if (!mediaStream) {
      setTrackSettingsSnapshot(null);
      return;
    }
    const track = mediaStream.getAudioTracks()[0];
    if (!track || typeof track.getSettings !== "function") {
      setTrackSettingsSnapshot(null);
      return;
    }
    setTrackSettingsSnapshot(track.getSettings());
  }, [deviceId, mediaStream]);

  useEffect(() => {
    if (!audioContext) {
      setAudioContextSnapshot(null);
      return;
    }
    setAudioContextSnapshot({
      sampleRate: audioContext.sampleRate,
      baseLatency: "baseLatency" in audioContext ? audioContext.baseLatency : undefined,
      outputLatency: "outputLatency" in audioContext ? audioContext.outputLatency : undefined
    });
  }, [audioContext]);

  const noSpeechCopy = analysis
    ? resolveNoSpeechCopy(analysis.verdict.copyKeys)
    : { title: "", description: "" };
  const isExcellent = analysis?.verdict.overall.grade === "A";

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

  const formatValue = useCallback((value: unknown) => {
    if (value === undefined || value === null || value === "") {
      return "Not available";
    }
    if (typeof value === "boolean") {
      return value ? "Enabled" : "Disabled";
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? `${value}` : "Not available";
    }
    return String(value);
  }, []);

  const recordingDetailsRows = useMemo(() => {
    const trackLatency =
      trackSettingsSnapshot && "latency" in trackSettingsSnapshot
        ? (trackSettingsSnapshot as MediaTrackSettings & { latency?: number }).latency
        : undefined;
    return [
      { label: "Auto gain control", value: formatValue(trackSettingsSnapshot?.autoGainControl) },
      { label: "Echo cancellation", value: formatValue(trackSettingsSnapshot?.echoCancellation) },
      { label: "Noise suppression", value: formatValue(trackSettingsSnapshot?.noiseSuppression) },
      { label: "Channel count", value: formatValue(trackSettingsSnapshot?.channelCount) },
      { label: "Sample rate", value: formatValue(trackSettingsSnapshot?.sampleRate) },
      { label: "Sample size", value: formatValue(trackSettingsSnapshot?.sampleSize) },
      { label: "Latency", value: formatValue(trackLatency) },
      { label: "AudioContext sample rate", value: formatValue(audioContextSnapshot?.sampleRate) },
      { label: "AudioContext base latency", value: formatValue(audioContextSnapshot?.baseLatency) },
      { label: "AudioContext output latency", value: formatValue(audioContextSnapshot?.outputLatency) }
    ];
  }, [audioContextSnapshot, formatValue, trackSettingsSnapshot]);

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
              className={buttonStyles({
                variant: "primary",
                className: "min-w-[11rem]"
              })}
              disabled={isAnalyzing}
              onClick={isRecording ? stopRecording : startRecording}
            >
              <span className="inline-flex min-w-[8rem] items-center justify-center gap-2">
                {isAnalyzing ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
                {buttonLabel}
              </span>
            </button>
            <div className="text-sm text-slate-400">Duration: {duration.toFixed(1)}s</div>
          </div>

          <details className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
              <span className="flex items-center justify-between">
                Recording details
                <span className="text-xs font-normal text-slate-400">Optional</span>
              </span>
            </summary>
            <div className="mt-3 text-xs text-slate-200">
              {!mediaStream ? (
                <p className="mb-3 text-slate-400">Grant mic access to view details.</p>
              ) : null}
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto,1fr]">
                {recordingDetailsRows.map((row) => (
                  <React.Fragment key={row.label}>
                    <span className="text-slate-400">{row.label}</span>
                    <span>{row.value}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </details>

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
              {isExcellent ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="text-lg font-semibold">{t("results.excellent.title")}</h2>
                  <p className="mt-3 text-sm text-slate-200">{t("results.excellent.body")}</p>
                  <p className="mt-3 text-xs text-slate-400">{t("results.excellent.share_hint")}</p>
                </div>
              ) : (
                <BestNextSteps
                  includeGear={viewMode === "pro"}
                  includeSecondaryNotes={viewMode === "pro"}
                  maxActionSteps={viewMode === "basic" ? 1 : undefined}
                  mode={viewMode}
                  showDiagnosticCertainty={viewMode === "pro"}
                  verdict={analysis.verdict}
                />
              )}
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
