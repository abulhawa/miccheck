"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeRecording } from "../lib/analysis";
import { clearRecording, saveRecording } from "../lib/audioStorage";
import { describeBrowserSupport } from "@miccheck/audio-core";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import type { AnalysisResult, ContextInput } from "../types";
import {
  DEFAULT_MAX_RECORDING_DURATION_SECONDS,
  DEFAULT_MIN_RECORDING_DURATION_SECONDS,
  METER_NORMALIZATION_MULTIPLIER
} from "../src/domain/recording/constants";

interface RecorderOptions {
  maxDuration?: number;
  minDuration?: number;
  deviceId?: string | null;
  analysisContext?: ContextInput;
}

type RecorderStatus = "idle" | "recording" | "analyzing" | "complete" | "error";

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
  analysisContext = DEFAULT_ANALYSIS_CONTEXT
}: RecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [level, setLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const meterNodeRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const updateMeterRef = useRef<() => void>(() => {});
  const hasLoggedResultsRef = useRef(false);

  const stopMediaStream = useCallback((stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  }, []);

  const clearStopTimeout = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  }, []);

  const stopMeter = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    meterNodeRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const clearRecorder = useCallback(() => {
    clearStopTimeout();
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore stop errors when cleaning up.
        }
      }
    }
    if (mediaStreamRef.current) {
      stopMediaStream(mediaStreamRef.current);
      mediaStreamRef.current = null;
    }
    setMediaStream(null);
    mediaRecorderRef.current = null;
    stopMeter();
    audioChunksRef.current = [];
    startTimeRef.current = null;
  }, [clearStopTimeout, stopMediaStream, stopMeter]);

  const reset = useCallback(() => {
    clearRecorder();
    setStatus("idle");
    setError(null);
    setAnalysis(null);
    setLevel(0);
    setDuration(0);
    setRecordingBlob(null);
    clearRecording();
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

    if (startTimeRef.current) {
      setDuration((performance.now() - startTimeRef.current) / 1000);
    }

    animationRef.current = requestAnimationFrame(() => updateMeterRef.current());
  }, []);

  useEffect(() => {
    updateMeterRef.current = updateMeter;
  }, [updateMeter]);

  const initializeRecorder = useCallback(async (overrideDeviceId?: string | null) => {
    clearRecorder();
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
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          ...(activeDeviceId ? { deviceId: { exact: activeDeviceId } } : {})
        }
      });
      mediaStreamRef.current = stream;
      setMediaStream(stream);

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        stopMediaStream(stream);
        mediaStreamRef.current = null;
        setStatus("error");
        setError("Web Audio API is unavailable in this browser.");
        return;
      }
      let audioContext: AudioContext;
      try {
        audioContext = new AudioContextClass();
      } catch (audioContextError) {
        stopMediaStream(stream);
        mediaStreamRef.current = null;
        setStatus("error");
        setError(
          audioContextError instanceof Error
            ? audioContextError.message
            : "Unable to initialize the Web Audio API."
        );
        return;
      }
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      meterNodeRef.current = analyser;

      if (typeof MediaRecorder === "undefined") {
        stopMediaStream(stream);
        mediaStreamRef.current = null;
        setStatus("error");
        setError("MediaRecorder is not available in this browser.");
        logEvent(ANALYTICS_EVENTS.unsupportedBrowser, { reason: "no_mediarecorder" });
        return;
      }

      const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearStopTimeout();
        stopMeter();
        if (mediaStreamRef.current) {
          stopMediaStream(mediaStreamRef.current);
          mediaStreamRef.current = null;
          setMediaStream(null);
        }
        setStatus("analyzing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          if (blob.size > 0) {
            logEvent(ANALYTICS_EVENTS.recordingCompleted);
          }
          setRecordingBlob(blob);
          saveRecording(blob).catch(() => {
            // Non-blocking storage failure: playback can still use in-memory blob.
          });
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
          const decodeContext = new AudioContextClass();
          const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
          await decodeContext.close();

          if (audioBuffer.duration < minDuration) {
            setStatus("error");
            setError(`Recording was too short. Please capture at least ${minDuration} seconds.`);
            return;
          }

          const result = analyzeRecording(audioBuffer, analysisContext);
          setAnalysis(result);
          setStatus("complete");
        } catch (analysisError) {
          setStatus("error");
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : "Unable to analyze recording."
          );
          logEvent(ANALYTICS_EVENTS.recordingFailed, { reason: "unknown" });
        }
      };
      updateMeter();
      setStatus("idle");
    } catch (permissionError) {
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
    clearStopTimeout,
    deviceId,
    analysisContext,
    minDuration,
    stopMediaStream,
    stopMeter,
    updateMeter
  ]);

  const startRecording = useCallback(async () => {
    logEvent(ANALYTICS_EVENTS.startRecording);
    reset();
    setError(null);
    await initializeRecorder();

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "inactive") {
      return;
    }

    recorder.start();
    startTimeRef.current = performance.now();
    setStatus("recording");
    updateMeter();

    stopTimeoutRef.current = window.setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        stopMediaStream(mediaRecorderRef.current.stream);
        mediaStreamRef.current = null;
        setMediaStream(null);
      }
    }, maxDuration * 1000);
  }, [initializeRecorder, maxDuration, reset, stopMediaStream, updateMeter]);

  const stopRecording = useCallback(() => {
    clearStopTimeout();

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      stopMediaStream(mediaRecorderRef.current.stream);
      mediaStreamRef.current = null;
      setMediaStream(null);
    }
  }, [clearStopTimeout, stopMediaStream]);

  useEffect(() => {
    return () => {
      clearRecorder();
    };
  }, [clearRecorder]);

  useEffect(() => {
    if (status === "complete" && !hasLoggedResultsRef.current) {
      logEvent(ANALYTICS_EVENTS.viewResults);
      hasLoggedResultsRef.current = true;
    }
  }, [status]);

  return {
    status,
    error,
    analysis,
    level,
    duration,
    mediaStream,
    recordingBlob,
    initializeRecorder,
    startRecording,
    stopRecording,
    reset
  };
}
