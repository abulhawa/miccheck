"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPcmCapture, type PcmCapture } from "../lib/pcmCapture";
import { clearSession, loadSession, saveSession } from "../lib/recordingSession";
import { pcmWav } from "../lib/wavEncoding";
import { analyzeLocally } from "../lib/localAnalysis";
import { clearRecording } from "../lib/audioStorage";
import { describeBrowserSupport } from "@miccheck/audio-core";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import type { AnalysisResult, ContextInput } from "../types";
import {
  DEFAULT_MAX_RECORDING_DURATION_SECONDS,
  DEFAULT_MIN_RECORDING_DURATION_SECONDS,
  ROOM_CALIBRATION_SECONDS,
  METER_NORMALIZATION_MULTIPLIER
} from "../src/domain/recording/constants";

interface RecorderOptions {
  maxDuration?: number;
  minDuration?: number;
  deviceId?: string | null;
  analysisContext?: ContextInput;
  discoverySource?: string;
  classifyNoise?: boolean;
  staged?: boolean;
}

type RecorderStatus = "idle" | "requesting" | "calibrating" | "checking_room" | "ready" | "recording" | "analyzing" | "complete" | "error";


const DEFAULT_ANALYSIS_CONTEXT: ContextInput = {
  use_case: "meetings",
  device_type: "unknown",
  mode: "single"
};

/**
 * useAudioRecorder handles microphone capture, level metering, and analysis.
 */
export function useAudioRecorder({
  maxDuration = DEFAULT_MAX_RECORDING_DURATION_SECONDS,
  minDuration = DEFAULT_MIN_RECORDING_DURATION_SECONDS,
  deviceId = null,
  analysisContext = DEFAULT_ANALYSIS_CONTEXT,
  classifyNoise = false,
  staged = false,
  discoverySource = "route:pro"
}: RecorderOptions) {
  const analysisAbortRef = useRef<AbortController | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const pcmCaptureRef = useRef<PcmCapture | null>(null);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const captureStageRef = useRef<'calibration' | 'ready' | 'speech' | null>(null);
  const roomSampleRef = useRef<{samples:Float32Array; sampleRate:number; format:'pcm' | 'encoded'} | null>(null);
  const [audioDataArray, setAudioDataArray] = useState<Float32Array | null>(null);
  const [peakVolume, setPeakVolume] = useState(0);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [level, setLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const meterNodeRef = useRef<AnalyserNode | null>(null);
  const meterSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const releasedStreamsRef = useRef(new WeakSet<MediaStream>());
  const startTimeRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const updateMeterRef = useRef<() => void>(() => {});
  const hasLoggedResultsRef = useRef(false);

  const debugLog = useCallback((event: string, details?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "production") {
      return;
    }
    console.debug(`[useAudioRecorder] ${event}`, details ?? {});
  }, []);

  const stopMediaStreamTracksOnce = useCallback(
    (stream: MediaStream | null, reason: string) => {
      if (!stream || releasedStreamsRef.current.has(stream)) {
        return;
      }

      const tracks = stream.getTracks();
      debugLog("stopping_stream_tracks", {
        reason,
        tracks: tracks.map((track) => ({ id: track.id, readyState: track.readyState, enabled: track.enabled }))
      });
      tracks.forEach((track) => track.stop());
      releasedStreamsRef.current.add(stream);
      debugLog("stopped_stream_tracks", {
        reason,
        tracks: tracks.map((track) => ({ id: track.id, readyState: track.readyState, enabled: track.enabled }))
      });
    },
    [debugLog]
  );

  const assertNoLiveTracks = useCallback(
    (stream: MediaStream | null, reason: string) => {
      if (process.env.NODE_ENV === "production" || !stream) {
        return;
      }
      const liveTracks = stream.getTracks().filter((track) => track.readyState === "live");
      if (liveTracks.length > 0) {
        console.warn("[useAudioRecorder] live_tracks_detected_after_release", {
          reason,
          tracks: liveTracks.map((track) => ({ id: track.id, enabled: track.enabled }))
        });
      }
    },
    []
  );

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    pcmCaptureRef.current?.dispose();
    pcmCaptureRef.current = null;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (meterSourceNodeRef.current) {
      meterSourceNodeRef.current.disconnect();
      meterSourceNodeRef.current = null;
    }
    if (meterNodeRef.current) {
      meterNodeRef.current.disconnect();
    }
    meterNodeRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioContext(null);
  }, []);

  const clearVideoElements = useCallback((stream: MediaStream | null) => {
    if (!stream || typeof document === "undefined") {
      return;
    }
    const mediaElements = Array.from(document.querySelectorAll("audio,video"));
    mediaElements.forEach((element) => {
      if ((element as HTMLMediaElement).srcObject === stream) {
        (element as HTMLMediaElement).srcObject = null;
      }
    });
  }, []);

  const releasePreviewMic = useCallback(
    (reason: string) => {
      const stream = previewStreamRef.current;
      stopMediaStreamTracksOnce(stream, reason);
      assertNoLiveTracks(stream, reason);
      clearVideoElements(stream);
      previewStreamRef.current = null;
      debugLog("released_preview_mic", { reason });
    },
    [assertNoLiveTracks, clearVideoElements, debugLog, stopMediaStreamTracksOnce]
  );

  const releaseRecordMic = useCallback(
    (reason: string) => {
      const stream = recordStreamRef.current;
      stopMeter();
      stopMediaStreamTracksOnce(stream, reason);
      assertNoLiveTracks(stream, reason);
      clearVideoElements(stream);

      recordStreamRef.current = null;
      setMediaStream(null);
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      startTimeRef.current = null;
      setLevel(0);
      setDuration(0);
      debugLog("released_record_mic", { reason });
    },
    [assertNoLiveTracks, clearVideoElements, debugLog, stopMediaStreamTracksOnce, stopMeter]
  );

  const releaseMic = useCallback(
    (reason: string) => {
      clearStopTimeout();

      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== "inactive") {
          try {
            recorder.stop();
          } catch {
            // Ignore stop errors when cleaning up.
          }
        }
      }

      releasePreviewMic(reason);
      releaseRecordMic(reason);
      debugLog("released_mic", { reason });
    },
    [clearStopTimeout, debugLog, releasePreviewMic, releaseRecordMic]
  );

  const clearRecorder = useCallback(() => {
    analysisAbortRef.current?.abort();
    generationRef.current += 1;
    busyRef.current = false;
    captureStageRef.current = null;
    roomSampleRef.current = null;
    releaseMic("clear_recorder");
  }, [releaseMic]);

  const reset = useCallback(() => {
    clearRecorder();
    setStatus("idle");
    setError(null);
    setAnalysis(null);
    setLevel(0);
    setAudioDataArray(null);
    setPeakVolume(0);
    setDuration(0);
    setRecordingBlob(null);
    clearRecording();
    clearSession();
    hasLoggedResultsRef.current = false;
  }, [clearRecorder]);

  const updateMeter = useCallback(() => {
    const analyser = meterNodeRef.current;
    if (!analyser) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let sum = 0;
    for (const value of buffer) {
      sum += value * value;
    }
    const rms = Math.sqrt(sum / buffer.length);
    const normalized = Math.min(1, rms * METER_NORMALIZATION_MULTIPLIER);
    setLevel(normalized);
    setAudioDataArray(buffer);
    setPeakVolume((previous) => Math.max(previous, normalized));

    if (startTimeRef.current) {
      setDuration((performance.now() - startTimeRef.current) / 1000);
    }

    animationRef.current = requestAnimationFrame(() => updateMeterRef.current());
  }, []);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {setAnalysis(saved.analysis);setRecordingBlob(saved.blob);setStatus("complete");}
  }, []);

  useEffect(() => {
    updateMeterRef.current = updateMeter;
  }, [updateMeter]);

  const initializeRecorder = useCallback(async (overrideDeviceId?: string | null) => {
    if (busyRef.current) return;
    clearRecorder();
    busyRef.current = true;
    const request = generationRef.current;
    setStatus("requesting");
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      setStatus("error");
      setError("Recording requires a secure (HTTPS) context.");
      logEvent(ANALYTICS_EVENTS.recordingFailed, { reason: "not_secure_context" });
      return;
    }
    const support = describeBrowserSupport();
    if (!support.isSupported) {
      setStatus("error");
      setError(`Browser not supported: ${support.issues.join(" ")}`);
      logEvent(ANALYTICS_EVENTS.unsupportedBrowser, { reason: "unknown" });
      return;
    }
    try {
      const activeDeviceId = overrideDeviceId ?? deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(activeDeviceId ? { deviceId: { exact: activeDeviceId } } : {})
        }
      });
      if (request !== generationRef.current) {
        stopMediaStreamTracksOnce(stream, "stale_permission");
        return;
      }
      recordStreamRef.current = stream;
      setMediaStream(stream);
      debugLog("acquired_stream", {
        tracks: stream
          .getTracks()
          .map((track) => ({ id: track.id, readyState: track.readyState, enabled: track.enabled }))
      });

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        releaseMic("audio_context_unavailable");
        setStatus("error");
        setError("Web Audio API is unavailable in this browser.");
        return;
      }
      let audioContext: AudioContext;
      try {
        audioContext = new AudioContextClass();
      } catch (audioContextError) {
        releaseMic("audio_context_initialization_failed");
        setStatus("error");
        setError(
          audioContextError instanceof Error
            ? audioContextError.message
            : "Unable to initialize the Web Audio API."
        );
        return;
      }
      audioContextRef.current = audioContext;
      setAudioContext(audioContext);
      const captureSettings = stream.getAudioTracks?.()[0]?.getSettings?.() ?? {};
      const source = audioContext.createMediaStreamSource(stream);
      meterSourceNodeRef.current = source;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      meterNodeRef.current = analyser;
      const pcmCapture = await createPcmCapture(audioContext, source).catch(() => null);
      if (request !== generationRef.current) {pcmCapture?.dispose(); return;}
      pcmCaptureRef.current = pcmCapture;
      await audioContext.resume?.();
      if (request !== generationRef.current) {pcmCapture?.dispose(); return;}

      if (typeof MediaRecorder === "undefined") {
        releaseMic("media_recorder_unavailable");
        setStatus("error");
        setError("MediaRecorder is not available in this browser.");
        logEvent(ANALYTICS_EVENTS.unsupportedBrowser, { reason: "no_mediarecorder" });
        return;
      }

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.onerror = () => {
        if (request !== generationRef.current) return;
        clearRecorder();
        setStatus("error");
        setError("Recording was interrupted. Reconnect your microphone and try again.");
      };
      stream.getTracks().forEach((track) => track.addEventListener?.("ended", () => {
        if (request !== generationRef.current || mediaRecorderRef.current !== recorder) return;
        clearRecorder();
        setStatus("error");
        setError("The microphone disconnected. Reconnect it and try again.");
      }, {once: true}));
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (request !== generationRef.current) return;
        clearStopTimeout();
        const isCalibration = captureStageRef.current === 'calibration';
        const recordedChunks = [...audioChunksRef.current];
        setStatus(isCalibration ? "checking_room" : "analyzing");
        const pcm = await pcmCaptureRef.current?.finish();
        if (request !== generationRef.current) return;
        const capturedRate = audioContext.sampleRate;
        if (!isCalibration) releaseMic("recorder_onstop");
        startTimeRef.current = null;
        try {
          const blob = new Blob(recordedChunks, { type: recorder.mimeType });
          if (blob.size > 0) {
            logEvent(ANALYTICS_EVENTS.recordingCompleted);
          }
          const arrayBuffer =
            typeof blob.arrayBuffer === "function"
              ? await blob.arrayBuffer()
              : typeof Response !== "undefined"
                ? await new Response(blob).arrayBuffer()
              : await new Promise<ArrayBuffer>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as ArrayBuffer);
                  reader.onerror = () => reject(reader.error ?? new Error("Unable to read blob."));
                  reader.readAsArrayBuffer(blob);
                });
          let decodeContext: AudioContext | null = null;
          let audioBuffer: AudioBuffer | null = null;
          try {
            if (pcm?.length) {
              audioBuffer = {numberOfChannels: 1, length: pcm.length, sampleRate: capturedRate, duration: pcm.length / capturedRate, getChannelData: () => pcm} as unknown as AudioBuffer;
            } else {
              decodeContext = new AudioContextClass();
              audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
            }
          } catch (decodeError) {
            throw decodeError instanceof Error
              ? decodeError
              : new Error("Unable to decode the recorded audio.");
          } finally {
            if (decodeContext) {
              try {
                await decodeContext.close();
              } catch {
                // Ignore close errors when cleaning up decoding context.
              }
            }
          }

          if (request !== generationRef.current) return;
          if (!audioBuffer) {
            throw new Error("Unable to decode the recorded audio.");
          }

          const capture = {format: pcm?.length ? "pcm" as const : "encoded" as const,echoCancellation:captureSettings.echoCancellation,noiseSuppression:captureSettings.noiseSuppression,autoGainControl:captureSettings.autoGainControl};
          if (isCalibration) {
            if (audioBuffer.duration < 2) throw new Error('The room sample was interrupted. Please measure the room again.');
            // Keep an exact, bounded room interval; delayed timers must not capture the preparation pause.
            const samples = audioBuffer.getChannelData(0).slice(0, Math.floor(ROOM_CALIBRATION_SECONDS * audioBuffer.sampleRate));
            const abort = new AbortController();
            analysisAbortRef.current = abort;
            const roomResult = await analyzeLocally(samples, audioBuffer.sampleRate, analysisContext, capture, false, abort.signal, setAnalysisStatus, samples.length / audioBuffer.sampleRate);
            if (request !== generationRef.current) return;
            if (!roomResult.evidence?.noiseReliable) throw new Error('Speech was detected during the room check. Measure the room again and stay quiet until it finishes.');
            roomSampleRef.current = {samples, sampleRate:audioBuffer.sampleRate, format:capture.format};
            captureStageRef.current = 'ready';
            audioChunksRef.current = [];
            setDuration(0);
            setStatus('ready');
            return;
          }

          if (audioBuffer.duration < minDuration) {
            setStatus("error");
            setError(`Recording was too short. Please capture at least ${minDuration} seconds.`);
            return;
          }

          const abort = new AbortController();
          analysisAbortRef.current = abort;
          const room = roomSampleRef.current;
          let samples = audioBuffer.getChannelData(0);
          if (staged && !room) throw new Error('Please measure the room before recording your voice.');
          if (room) {
            if (room.format === 'encoded') capture.format = 'encoded';
            if (room.sampleRate !== audioBuffer.sampleRate) throw new Error('The microphone format changed. Please measure the room again.');
            const combined = new Float32Array(room.samples.length + samples.length);
            combined.set(room.samples);
            combined.set(samples, room.samples.length);
            samples = combined;
          }
          const result = await analyzeLocally(samples, audioBuffer.sampleRate, analysisContext, capture, classifyNoise, abort.signal, setAnalysisStatus, room ? room.samples.length / room.sampleRate : 2);
          if (request !== generationRef.current) return;
          const verdictPassFail = result.verdict.useCaseFit === "pass" ? "pass" : "fail";
          logEvent(ANALYTICS_EVENTS.analysisCompleted, {
            discovery_source: discoverySource,
            selected_use_case: analysisContext.use_case,
            verdict_pass_fail: verdictPassFail,
            diagnostic_certainty: result.verdict.diagnosticCertainty ?? "unknown"
          });
          const playbackBlob = room || pcm?.length ? pcmWav(samples, audioBuffer.sampleRate) : blob;
          roomSampleRef.current = null;
          setRecordingBlob(playbackBlob);
          void saveSession({id:crypto.randomUUID(),createdAt:Date.now(),analysis:result,blob:playbackBlob,deviceId:activeDeviceId});
          setAnalysis(result);
          setStatus("complete");
        } catch (analysisError) {
          if (request !== generationRef.current) return;
          releaseMic('analysis_error');
          roomSampleRef.current = null;
          captureStageRef.current = null;
          setStatus("error");
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : "Unable to analyze recording."
          );
          logEvent(ANALYTICS_EVENTS.recordingFailed, { reason: "unknown" });
        } finally {
          if (request === generationRef.current) busyRef.current = false;
        }
      };
      setStatus("idle");
      return request;
    } catch (permissionError) {
      if (request !== generationRef.current) return;
      releaseMic("permission_or_stream_error");
      setStatus("error");
      if (permissionError instanceof DOMException) {
        if (permissionError.name === "NotAllowedError") {
          setError("Microphone permission denied. Please allow access and try again.");
          logEvent(ANALYTICS_EVENTS.permissionDenied);
          return;
        }
        if (permissionError.name === "NotFoundError") {
          setError("No microphone detected. Please connect one and try again.");
          logEvent(ANALYTICS_EVENTS.recordingFailed, { reason: "unknown" });
          return;
        }
      }
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : "Unable to access the microphone."
      );
      logEvent(ANALYTICS_EVENTS.recordingFailed, { reason: "unknown" });
    }
  }, [
    clearRecorder,
    deviceId,
    analysisContext,
    discoverySource,
    classifyNoise,
    staged,
    clearStopTimeout,
    debugLog,
    minDuration,
    stopMediaStreamTracksOnce,
    releaseMic
  ]);

  const beginCapture = useCallback(async (stage: 'calibration' | 'speech') => {
    if (busyRef.current) return;
    logEvent(ANALYTICS_EVENTS.startRecording);
    reset();
    setError(null);
    releasePreviewMic("start_recording");
    const expectedRequest = generationRef.current + 1;
    const request = await initializeRecorder();
    if (request === undefined || request !== generationRef.current) {
      if (request === undefined && generationRef.current === expectedRequest) busyRef.current = false;
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "inactive") {
      return;
    }

    try {
      captureStageRef.current = stage;
      recorder.start();
      pcmCaptureRef.current?.start();
    } catch (startError) {
      clearRecorder();
      setStatus("error");
      setError(startError instanceof Error ? startError.message : "Unable to start recording.");
      return;
    }
    startTimeRef.current = performance.now();
    setStatus(stage === 'calibration' ? "calibrating" : "recording");
    updateMeter();

    stopTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, (stage === 'calibration' ? ROOM_CALIBRATION_SECONDS : maxDuration) * 1000);
  }, [clearRecorder, initializeRecorder, maxDuration, releasePreviewMic, reset, updateMeter]);

  const startCalibration = useCallback(() => beginCapture('calibration'), [beginCapture]);

  const startRecording = useCallback(async () => {
    if (!staged) return beginCapture('speech');
    const recorder = mediaRecorderRef.current;
    if (busyRef.current || captureStageRef.current !== 'ready' || !roomSampleRef.current || !recorder || recorder.state !== 'inactive') return;
    busyRef.current = true;
    captureStageRef.current = 'speech';
    audioChunksRef.current = [];
    try {
      recorder.start();
      pcmCaptureRef.current?.start();
      startTimeRef.current = performance.now();
      setDuration(0);
      setPeakVolume(0);
      setStatus('recording');
      stopTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, maxDuration * 1000);
    } catch {
      clearRecorder();
      setStatus('error');
      setError('Unable to start voice recording. Please measure the room again.');
    }
  }, [staged, beginCapture, maxDuration, clearRecorder]);

  const stopRecording = useCallback(() => {
    clearStopTimeout();

    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
      setStatus("analyzing");
    }
  }, [clearStopTimeout]);

  useEffect(() => {
    return () => {
      clearRecorder();
    };
  }, [clearRecorder, releasePreviewMic, releaseRecordMic]);

  useEffect(() => {
    if (status === "complete" && !hasLoggedResultsRef.current) {
      logEvent(ANALYTICS_EVENTS.viewResults);
      hasLoggedResultsRef.current = true;
    }
  }, [status]);

  return {
    status,
    analysisStatus,
    error,
    analysis,
    level,
    audioDataArray,
    currentVolume: level,
    peakVolume,
    duration,
    mediaStream,
    recordingBlob,
    audioContext,
    initializeRecorder,
    startCalibration,
    startRecording,
    stopRecording,
    reset
  };
}
