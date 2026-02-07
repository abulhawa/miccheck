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
import { isIOSPlatform } from "../lib/browserUtils";
import { resolveNoSpeechCopy } from "../lib/copy";
import { t } from "../lib/i18n";
import { buttonStyles } from "./buttonStyles";
import type { DeviceType, UseCase } from "../types";

const DEVICE_OVERRIDE_STORAGE_KEY = "miccheck.analysis.deviceOverride.v1";
const VIEW_MODE_STORAGE_KEY = "miccheck.view.mode.v1";

type ViewMode = "basic" | "pro";

interface TestExperiencePageProps {
  viewMode: ViewMode;
  initialUseCase?: UseCase;
  initialDiscoverySource?: string;
}

export default function TestExperiencePage({
  viewMode,
  initialUseCase,
  initialDiscoverySource
}: TestExperiencePageProps) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [useCase, setUseCase] = useState<UseCase>("meetings");
  const [discoverySource, setDiscoverySource] = useState("route:pro");
  const [detectedDeviceType, setDetectedDeviceType] = useState<DeviceType>("unknown");
  const [deviceTypeOverride, setDeviceTypeOverride] = useState<DeviceType | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [deviceRefreshSignal, setDeviceRefreshSignal] = useState("0");
  const [isRecordingDetailsOpen, setIsRecordingDetailsOpen] = useState(false);
  const [trackSettingsSnapshot, setTrackSettingsSnapshot] = useState<MediaTrackSettings | null>(null);
  const [audioContextSnapshot, setAudioContextSnapshot] = useState<{
    sampleRate?: number;
    baseLatency?: number;
    outputLatency?: number;
  } | null>(null);
  const detailsProbeRequestIdRef = useRef(0);

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
  } = useAudioRecorder({ maxDuration: 7, deviceId, analysisContext, discoverySource });

  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";

  const { audioDataArray, currentVolume, peakVolume } = useAudioMeter({
    stream: mediaStream,
    isActive: isRecording
  });

  useEffect(() => {
    const storedContext = loadAnalysisContext();
    setUseCase(initialUseCase ?? storedContext.use_case);
    setDiscoverySource(initialDiscoverySource ?? storedContext.discovery_source);

    const storedOverride = window.localStorage.getItem(DEVICE_OVERRIDE_STORAGE_KEY);
    if (storedOverride) {
      setDeviceTypeOverride(storedOverride as DeviceType);
    }

    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [initialDiscoverySource, initialUseCase, viewMode]);

  useEffect(() => {
    saveAnalysisContext({
      use_case: useCase,
      device_type: "unknown",
      mode: viewMode,
      discovery_source: discoverySource
    });
  }, [discoverySource, useCase, viewMode]);

  useEffect(() => {
    if (deviceTypeOverride) {
      window.localStorage.setItem(DEVICE_OVERRIDE_STORAGE_KEY, deviceTypeOverride);
      return;
    }
    window.localStorage.removeItem(DEVICE_OVERRIDE_STORAGE_KEY);
  }, [deviceTypeOverride]);

  useEffect(() => {
    setIsIOSDevice(isIOSPlatform());
  }, []);

  useEffect(() => {
    if (status === "recording") {
      setDeviceRefreshSignal((current) => `${Number(current) + 1}`);
    }
  }, [status]);

  useEffect(() => {
    if (!mediaStream) {
      return;
    }
    const track = mediaStream.getAudioTracks()[0];
    if (!track || typeof track.getSettings !== "function") {
      return;
    }
    setTrackSettingsSnapshot(track.getSettings());
  }, [deviceId, mediaStream]);

  useEffect(() => {
    if (!audioContext) {
      return;
    }
    setAudioContextSnapshot({
      sampleRate: audioContext.sampleRate,
      baseLatency: "baseLatency" in audioContext ? audioContext.baseLatency : undefined,
      outputLatency: "outputLatency" in audioContext ? audioContext.outputLatency : undefined
    });
  }, [audioContext]);

  useEffect(() => {
    if (mediaStream || status === "recording" || status === "analyzing") {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !navigator.permissions?.query
    ) {
      return;
    }

    let isCancelled = false;
    let probeStream: MediaStream | null = null;
    const requestId = ++detailsProbeRequestIdRef.current;

    const stopProbeStream = () => {
      if (!probeStream) return;
      probeStream.getTracks().forEach((track) => track.stop());
      probeStream = null;
    };

    const probeDetails = async () => {
      try {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName
        });
        if (permissionStatus.state !== "granted") {
          return;
        }

        probeStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            ...(deviceId ? { deviceId: { exact: deviceId } } : {})
          }
        });
        if (isCancelled || requestId !== detailsProbeRequestIdRef.current) {
          stopProbeStream();
          return;
        }

        const track = probeStream.getAudioTracks()[0];
        if (track && typeof track.getSettings === "function") {
          setTrackSettingsSnapshot(track.getSettings());
        }

        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }
        const probeAudioContext = new AudioContextClass();
        setAudioContextSnapshot({
          sampleRate: probeAudioContext.sampleRate,
          baseLatency:
            "baseLatency" in probeAudioContext ? probeAudioContext.baseLatency : undefined,
          outputLatency:
            "outputLatency" in probeAudioContext ? probeAudioContext.outputLatency : undefined
        });
        await probeAudioContext.close();
      } catch {
        // Keep previously captured details when probing fails.
      } finally {
        stopProbeStream();
      }
    };

    void probeDetails();

    return () => {
      isCancelled = true;
      stopProbeStream();
    };
  }, [deviceId, mediaStream, status]);

  const noSpeechCopy = analysis
    ? resolveNoSpeechCopy(analysis.verdict.copyKeys)
    : { title: "", description: "" };
  const isExcellent = analysis?.verdict.overall.grade === "A";

  const buttonLabel = useMemo(() => {
    if (isRecording) return t("test.recording.stop");
    if (isAnalyzing) return t("test.recording.analyzing");
    return t("test.recording.start");
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
      return t("test.details.not_available");
    }
    if (typeof value === "boolean") {
      return value ? t("test.details.enabled") : t("test.details.disabled");
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? `${value}` : t("test.details.not_available");
    }
    return String(value);
  }, []);

  const recordingDetailsRows = useMemo(() => {
    const trackLatency =
      trackSettingsSnapshot && "latency" in trackSettingsSnapshot
        ? (trackSettingsSnapshot as MediaTrackSettings & { latency?: number }).latency
        : undefined;
    return [
      { label: t("test.details.auto_gain_control"), value: formatValue(trackSettingsSnapshot?.autoGainControl) },
      { label: t("test.details.echo_cancellation"), value: formatValue(trackSettingsSnapshot?.echoCancellation) },
      { label: t("test.details.noise_suppression"), value: formatValue(trackSettingsSnapshot?.noiseSuppression) },
      { label: t("test.details.channel_count"), value: formatValue(trackSettingsSnapshot?.channelCount) },
      { label: t("test.details.sample_rate"), value: formatValue(trackSettingsSnapshot?.sampleRate) },
      { label: t("test.details.sample_size"), value: formatValue(trackSettingsSnapshot?.sampleSize) },
      { label: t("test.details.latency"), value: formatValue(trackLatency) },
      { label: t("test.details.audio_context_sample_rate"), value: formatValue(audioContextSnapshot?.sampleRate) },
      { label: t("test.details.audio_context_base_latency"), value: formatValue(audioContextSnapshot?.baseLatency) },
      { label: t("test.details.audio_context_output_latency"), value: formatValue(audioContextSnapshot?.outputLatency) }
    ];
  }, [audioContextSnapshot, formatValue, trackSettingsSnapshot]);

  const hasCapturedRecordingDetails = trackSettingsSnapshot !== null || audioContextSnapshot !== null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 md:gap-8">
      <section>
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-200">{t("test.header.eyebrow")}</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{t("test.header.title")}</h1>
          <p className="text-sm text-slate-200">
            {t("test.header.subtitle")}
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-4 sm:gap-5 md:mt-6 md:gap-6">
          <div className="flex gap-3 text-xs font-semibold">
            <Link
              className={viewMode === "basic" ? "text-white underline" : "text-slate-300"}
              href="/test"
            >
              {t("test.view.basic")}
            </Link>
            <span className="text-slate-500">/</span>
            <Link
              className={viewMode === "pro" ? "text-white underline" : "text-slate-300"}
              href="/pro"
            >
              {t("test.view.pro")}
            </Link>
          </div>

          {!analysis ? (
            <>
              <AudioWaveformVisualizer
                audioDataArray={audioDataArray}
                currentVolume={currentVolume}
                peakVolume={peakVolume}
                isRecording={isRecording}
              />

              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
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
                <div className="text-sm text-slate-400">
                  {t("test.recording.duration", { seconds: duration.toFixed(1) })}
                </div>
              </div>

              {isIOSDevice ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {t("test.ios.note")}
                </div>
              ) : null}

              <DeviceSelector onDeviceChange={handleDeviceChange} refreshSignal={deviceRefreshSignal} />
              <p className="text-xs text-slate-400">
                {t("test.detected_device_type", { type: formatDeviceTypeLabel(detectedDeviceType) })}
              </p>

              {viewMode === "pro" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    {t("test.controls.use_case")}
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
                    {t("test.controls.device_type")}
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                      onChange={(event) =>
                        setDeviceTypeOverride(
                          event.target.value === "auto" ? null : (event.target.value as DeviceType)
                        )
                      }
                      value={deviceTypeOverride ?? "auto"}
                    >
                      <option value="auto">{t("test.controls.auto", { type: formatDeviceTypeLabel(resolvedDeviceType) })}</option>
                      {ANALYSIS_CONTEXT_OPTIONS.deviceTypes.map((deviceType) => (
                        <option key={deviceType} value={deviceType}>
                          {formatDeviceTypeLabel(deviceType)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <details
                className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3"
                onToggle={(event) => setIsRecordingDetailsOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
                  <span className="flex items-center justify-between">
                    {t("test.details.title")}
                    <span className="text-xs font-normal text-slate-400">
                      {isRecordingDetailsOpen ? t("test.details.collapse") : t("test.details.expand")}
                    </span>
                  </span>
                </summary>
                <div className="mt-3 text-xs text-slate-200">
                  {!mediaStream ? (
                    !hasCapturedRecordingDetails ? (
                      <p className="mb-3 text-slate-400">{t("test.details.grant_access")}</p>
                    ) : null
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

              {error ? (
                <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </>
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
            <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-5 sm:p-6 md:p-8">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
                  {t("test.no_speech.badge")}
                </p>
                <h2 className="text-2xl font-semibold text-white">{noSpeechCopy.title}</h2>
                <p className="text-sm text-rose-100">{noSpeechCopy.description}</p>
              </div>
              <button
                className="mt-5 inline-flex w-full justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:mt-6"
                onClick={handleTestAgain}
                type="button"
              >
                {t("results.cta.run_another_test")}
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
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
                <div className="mt-6 flex flex-wrap gap-4">
                  <button
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
                    onClick={handleTestAgain}
                  >
                    {t("results.cta.run_another_test")}
                  </button>
                </div>
              </div>
            </section>
          )}
        </>
      ) : null}

      {recordingBlob ? <AudioPlayer audioBlob={recordingBlob} showWaveform={true} /> : null}
    </div>
  );
}
