"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AudioPlayer from "./AudioPlayer";
import AudioWaveformVisualizer from "./AudioWaveformVisualizer";
import DeviceSelector from "./DeviceSelector";
import ScoreCard from "./ScoreCard";
import BestNextSteps from "./BestNextSteps";
import ResultsNotice from "./ResultsNotice";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { ROOM_CALIBRATION_SECONDS } from "../src/domain/recording/constants";
import {
  ANALYSIS_CONTEXT_OPTIONS,
  formatDeviceTypeLabel,
  formatUseCaseLabel,
  loadAnalysisContext,
  saveAnalysisContext
} from "../lib/analysisContextStorage";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import { isIOSPlatform } from "../lib/browserUtils";
import { t } from "../lib/i18n";
import { buttonStyles } from "./buttonStyles";
import { clearSession, loadSession, saveSession, comparableTakes, type RecordingSession } from "../lib/recordingSession";
import { readStorage, writeStorage } from "../lib/safeStorage";
import type { DeviceType, UseCase } from "../types";

const DEVICE_OVERRIDE_STORAGE_KEY = "miccheck.analysis.deviceOverride.v1";
const VIEW_MODE_STORAGE_KEY = "miccheck.view.mode.v1";
const VOICE_RECORDING_SECONDS = 20;
const MIN_VOICE_SECONDS = 3;

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
  const [baseline, setBaseline] = useState<RecordingSession | null>(null);
  const playbackRef = useRef<HTMLDivElement>(null);
  const [classifyNoise, setClassifyNoise] = useState(false);
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

  const resolvedDeviceType = deviceTypeOverride ?? detectedDeviceType;
  const analysisContext = useMemo(
    () => ({ use_case: viewMode === "basic" ? "meetings" : useCase, device_type: resolvedDeviceType, mode: viewMode }),
    [resolvedDeviceType, useCase, viewMode]
  );

  const {
    status,
    analysisStatus,
    error,
    duration,
    audioDataArray,
    currentVolume,
    peakVolume,
    mediaStream,
    audioContext,
    recordingBlob,
    analysis,
    startCalibration,
    startRecording,
    stopRecording,
    reset
  } = useAudioRecorder({ staged: true, maxDuration: VOICE_RECORDING_SECONDS, minDuration: MIN_VOICE_SECONDS, deviceId, analysisContext, discoverySource, classifyNoise });

  const isRecording = status === "recording";
  const isAnalyzing = status === "analyzing";

  const isRequesting = status === "requesting";
  const isCalibrating = status === "calibrating";
  const isCheckingRoom = status === "checking_room";
  const isReady = status === "ready";
  const setupLocked = isRecording || isRequesting || isAnalyzing || isCalibrating || isCheckingRoom || isReady;

  useEffect(() => {
    if (analysis && recordingBlob) playbackRef.current?.scrollIntoView({block:'start',behavior:'smooth'});
  }, [analysis, recordingBlob]);

  useEffect(() => {
    setBaseline(loadSession("baseline"));
    const storedContext = loadAnalysisContext();
    setUseCase(initialUseCase ?? storedContext.use_case);
    setDiscoverySource(initialDiscoverySource ?? storedContext.discovery_source);

    const storedOverride = readStorage("localStorage", DEVICE_OVERRIDE_STORAGE_KEY);
    if (storedOverride && ANALYSIS_CONTEXT_OPTIONS.deviceTypes.includes(storedOverride as DeviceType)) {
      setDeviceTypeOverride(storedOverride as DeviceType);
    }

    writeStorage("localStorage", VIEW_MODE_STORAGE_KEY, viewMode);
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
      writeStorage("localStorage", DEVICE_OVERRIDE_STORAGE_KEY, deviceTypeOverride);
      return;
    }
    writeStorage("localStorage", DEVICE_OVERRIDE_STORAGE_KEY, null);
  }, [deviceTypeOverride]);

  useEffect(() => {
    setIsIOSDevice(isIOSPlatform());
  }, []);

  useEffect(() => {
    if (status === "calibrating") {
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

  const needsRetry = analysis?.specialState === "NO_SPEECH" || analysis?.specialState === "INSUFFICIENT_EVIDENCE";
  const retryReason = analysis?.evidence?.retryReason ?? (analysis?.specialState === "NO_SPEECH" ? "no_speech" : "insufficient_evidence");
  const isExcellent = analysis?.verdict.overall.grade === "A";

  const buttonLabel = useMemo(() => {
    if (isRequesting) return "Waiting for microphone…";
    if (isCalibrating) return "Measuring room…";
    if (isCheckingRoom) return "Checking room sample…";
    if (isReady) return "Start voice recording";
    if (isRecording) return "Finish recording";
    if (isAnalyzing) return t("test.recording.analyzing");
    return "Measure my room";
  }, [isRecording, isAnalyzing, isRequesting, isCalibrating, isCheckingRoom, isReady]);

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

    const current = loadSession();
    if (current && !current.analysis.specialState) {
      setBaseline(current);
      void saveSession(current, "baseline");
    }
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
          <h1 className="text-2xl font-semibold sm:text-3xl">{analysis ? 'Your microphone result' : t("test.header.title")}</h1>
          <p className="text-sm text-slate-200">
            {analysis ? 'Listen to your recording, then review the measurements and suggested next steps.' : 'First measure your room, then record your voice when you are ready. There is no rush between steps.'}
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
              <ol aria-label="Microphone test steps" className="grid gap-3 sm:grid-cols-2">
                <li aria-current={!isReady && !isRecording && !isAnalyzing ? 'step' : undefined} className={`rounded-2xl border p-4 ${!isReady && !isRecording && !isAnalyzing ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-900/50'}`}>
                  <h2 className="text-lg font-semibold text-white">1. Measure your room</h2>
                  <p className="mt-1 text-sm text-slate-300">Stay quiet for {ROOM_CALIBRATION_SECONDS} seconds. We measure background noise separately from your voice.</p>
                </li>
                <li aria-current={isReady || isRecording ? 'step' : undefined} className={`rounded-2xl border p-4 ${isReady || isRecording ? 'border-sky-400 bg-sky-500/10' : 'border-slate-700 bg-slate-900/50'}`}>
                  <h2 className="text-lg font-semibold text-white">2. Record your voice</h2>
                  <p className="mt-1 text-sm text-slate-300">Start when you are ready. Read at your own pace, then finish. You have up to {VOICE_RECORDING_SECONDS} seconds.</p>
                </li>
              </ol>
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4" role="status" aria-live="polite">
                {isRequesting ? 'Allow microphone access. The room check will begin once your microphone is ready; please stay quiet.' : isCalibrating ? 'Stay quiet while we measure your room. Voice recording will not start automatically.' : isCheckingRoom ? 'Checking that the room sample is free of speech…' : isReady ? 'Room check complete. Take your time to read the passage, then start voice recording. The microphone stays connected, but nothing is being recorded while you prepare.' : isAnalyzing ? analysisStatus || 'Preparing local analysis…' : isRecording ? 'Recording your voice. Read the passage below naturally, then choose Finish recording.' : 'Choose Measure my room when you are ready to stay quiet for three seconds. Your audio stays on this device.'}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <button
                  className={buttonStyles({
                    variant: "primary",
                    className: "min-w-[11rem]"
                  })}
                  disabled={isAnalyzing || isRequesting || isCalibrating || isCheckingRoom || (isRecording && duration < MIN_VOICE_SECONDS)}
                  onClick={isRecording ? stopRecording : isReady ? startRecording : startCalibration}
                >
                  <span className="inline-flex min-w-[8rem] items-center justify-center gap-2">
                    {isAnalyzing ? <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
                    {buttonLabel}
                  </span>
                </button>
                {setupLocked && <button type="button" className={buttonStyles({variant:'secondary'})} onClick={reset}>{isReady ? 'Start over' : 'Cancel'}</button>}
                <div aria-live="off" className="text-sm text-slate-400">
                  {isCalibrating ? `${Math.max(0, ROOM_CALIBRATION_SECONDS - duration).toFixed(0)} seconds remaining` : isRecording ? `${duration.toFixed(1)} / ${VOICE_RECORDING_SECONDS} seconds${duration < MIN_VOICE_SECONDS ? ' · Keep speaking…' : ''}` : isReady ? 'Voice recording starts only when you choose.' : ''}
                </div>
              </div>

              <section aria-labelledby="reading-passage-title" className={`rounded-2xl border-2 p-5 sm:p-7 ${isReady || isRecording ? 'border-sky-300 bg-slate-800' : 'border-slate-600 bg-slate-900'}`}>
                <h2 id="reading-passage-title" className="text-sm font-semibold uppercase tracking-wider text-sky-200">Read this aloud in step 2</h2>
                <blockquote className="mt-4 text-xl font-medium leading-relaxed text-white sm:text-2xl sm:leading-relaxed">
                  “{t("test.header.read_prompt_sample")}”
                </blockquote>
                <p className="mt-4 text-sm text-slate-300">Use your normal speaking voice and usual microphone distance. Aim for 10–15 seconds; you can also say a few sentences of your own.</p>
              </section>
              <label className="flex items-start gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={classifyNoise} disabled={setupLocked} onChange={(event) => setClassifyNoise(event.target.checked)} className="mt-1" />
                <span>Identify background sounds with local AI <span className="block text-xs text-slate-400">Experimental. Downloads an additional 16 MB model; no audio is uploaded.</span></span>
              </label>
              <AudioWaveformVisualizer
                audioDataArray={audioDataArray}
                currentVolume={currentVolume}
                peakVolume={peakVolume}
                isRecording={isRecording || isCalibrating}
              />

              {isIOSDevice ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  {t("test.ios.note")}
                </div>
              ) : null}

              <fieldset disabled={setupLocked}><DeviceSelector onDeviceChange={handleDeviceChange} refreshSignal={deviceRefreshSignal} /></fieldset>
              <p className="text-xs text-slate-400">
                {t("test.detected_device_type", { type: formatDeviceTypeLabel(detectedDeviceType) })}
              </p>

              {viewMode === "pro" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    {t("test.controls.use_case")}
                    <select
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                      disabled={setupLocked}
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
                      disabled={setupLocked}
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
                <div role="alert" className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {recordingBlob && analysis ? (
        <div ref={playbackRef} className="scroll-mt-6">
          {baseline && !needsRetry ? (
            <section className="rounded-2xl border border-sky-500/30 p-5">
              <h2 className="text-lg font-semibold">Before and after</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">Before · {baseline.analysis.verdict.overall.grade}</p>
                  <AudioPlayer audioBlob={baseline.blob} showWaveform={false} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">After · {analysis.verdict.overall.grade}</p>
                  <AudioPlayer audioBlob={recordingBlob} showWaveform={false} />
                </div>
              </div>
              {(() => {const current=loadSession();return current && comparableTakes(baseline,current) ? <p className="mt-2 text-sm text-slate-300">Speech level: {(analysis.metrics.speechRmsDb-baseline.analysis.metrics.speechRmsDb).toFixed(1)} dB change · SNR: {(analysis.metrics.snrDb-baseline.analysis.metrics.snrDb).toFixed(1)} dB change · Clipping: {((analysis.metrics.clippingRatio-baseline.analysis.metrics.clippingRatio)*100).toFixed(2)} percentage points change. A higher level is not always better; aim for the recommended range.</p> : <p className="mt-2 text-sm text-amber-200">Capture settings or evidence differ. Listen to both takes; numerical changes may not be directly comparable.</p>;})()}
              <button type="button" className="mt-3 text-sm underline" onClick={()=>{clearSession('baseline');setBaseline(null);}}>Clear comparison</button>
            </section>
          ) : null}
          {(!baseline || needsRetry) ? <AudioPlayer audioBlob={recordingBlob} showWaveform={false} /> : null}
        </div>
      ) : null}

      {analysis ? (
        <>
          {!needsRetry && <ResultsNotice
            diagnosticCertainty={analysis.verdict.diagnosticCertainty}
            specialState={analysis.specialState}
          />}

          {needsRetry ? (
            <section className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-5 sm:p-6 md:p-8">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
                  {t(`test.retry.${retryReason}.badge`)}
                </p>
                <h2 className="text-2xl font-semibold text-white">{t(`test.retry.${retryReason}.title`)}</h2>
                <p className="text-sm text-rose-100">{t(`test.retry.${retryReason}.description`)}</p>
              </div>
              <button
                className={buttonStyles({
                  variant: "primary",
                  className: "mt-5 w-full sm:mt-6"
                })}
                onClick={handleTestAgain}
                type="button"
              >
                {t("results.cta.run_another_test")}
              </button>
            </section>
          ) : (
            <section className="flex flex-col gap-5">
              <div className="flex flex-col gap-4">
                <ScoreCard
                  experimentalEcho={Boolean(analysis.evidence?.echoExperimental)}
                  highlightedCategoryId={analysis.verdict.primaryIssue}
                  metrics={analysis.metrics}
                  verdict={analysis.verdict}
                />
                <button
                  className={buttonStyles({
                    variant: "primary",
                    className: "w-full"
                  })}
                  onClick={handleTestAgain}
                  type="button"
                >
                  {t("results.cta.run_another_test")}
                </button>
              </div>
              {isExcellent ? (
                <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
                  <h2 className="text-lg font-semibold">{t("results.excellent.title")}</h2>
                  <p className="mt-3 text-sm text-slate-200">{t("results.excellent.body")}</p>
                  <p className="mt-3 text-xs text-slate-400">{t("results.excellent.share_hint")}</p>
                </div>
              ) : (
                <BestNextSteps
                  includeGear={false}
                  includeSecondaryNotes={viewMode === "pro"}
                  maxActionSteps={viewMode === "basic" ? 1 : undefined}
                  mode={viewMode}
                  showDiagnosticCertainty={viewMode === "pro"}
                  verdict={analysis.verdict}
                />
              )}
            </section>
          )}
        </>
      ) : null}

      {analysis?.evidence ? (
        <section className="rounded-2xl border border-slate-800 p-5 text-sm text-slate-300">
          <h2 className="font-semibold text-white">What this result is based on</h2>
          <p className="mt-2">{analysis.evidence.speechSeconds.toFixed(1)} seconds of detected speech · {analysis.evidence.quietSeconds.toFixed(1)} seconds of room calibration · {analysis.evidence.capture.format === 'pcm' ? 'Raw PCM capture' : 'Encoded audio fallback'}</p>
          <p className="mt-2">{analysis.ai?.engine ?? 'Speech detector'} runs locally. Echo is experimental and excluded from your grade. Results describe this recording, not your microphone in every setting.</p>
          {analysis.evidence.capture.echoCancellation !== false || analysis.evidence.capture.noiseSuppression !== false || analysis.evidence.capture.autoGainControl !== false ? <p className="mt-2 text-amber-200">Your browser may be processing the signal. Compare recordings made with the same settings.</p> : null}
          {analysis.ai?.noiseStatus === 'ready' ? <p className="mt-3">{analysis.ai.background ? 'Possible background sound: ' + analysis.ai.background.label + '. ' + analysis.ai.background.advice : 'No supported background sound was identified confidently.'} Sound labels are experimental suggestions.</p> : null}
          {analysis.ai?.noiseStatus === 'unavailable' ? <p className="mt-3">Sound classification was unavailable. Speech and level measurements are still shown.</p> : null}
          {analysis.ai?.segments.length ? <div className="mt-3"><p className="text-xs">Detected speech intervals</p><div className="relative mt-2 h-3 overflow-hidden rounded bg-slate-800" role="img" aria-label={analysis.ai.segments.map((segment) => segment.start.toFixed(1) + ' to ' + segment.end.toFixed(1) + ' seconds').join(', ')}>{analysis.ai.segments.map((segment, index) => <span key={index} className="absolute h-3 bg-sky-400" style={{left: Math.min(100,segment.start / 7 * 100) + '%',width: Math.min(100,(segment.end - segment.start) / 7 * 100) + '%'}} />)}</div></div> : null}
        </section>
      ) : null}
      {(isRequesting || isAnalyzing) ? <button type="button" onClick={reset} className="text-sm underline">Cancel</button> : null}
    </div>
  );
}
