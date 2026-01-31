"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeRecording } from "../lib/analysis";
import { describeBrowserSupport } from "@miccheck/audio-core";
import type { AnalysisResult } from "../types";

interface RecorderOptions {
  maxDuration?: number;
  minDuration?: number;
  deviceId?: string | null;
}

type RecorderStatus = "idle" | "recording" | "analyzing" | "complete" | "error";

const DEFAULT_MAX_DURATION = 6;
const DEFAULT_MIN_DURATION = 5;

/**
 * useAudioRecorder handles microphone capture, level metering, and analysis.
 */
export function useAudioRecorder({
  maxDuration = DEFAULT_MAX_DURATION,
  minDuration = DEFAULT_MIN_DURATION,
  deviceId = null
}: RecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [level, setLevel] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationRef = useRef<number | null>(null);
  const meterNodeRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const updateMeterRef = useRef<() => void>(() => {});

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
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    stopMeter();
    audioChunksRef.current = [];
    startTimeRef.current = null;
  }, [clearStopTimeout, stopMeter]);

  const reset = useCallback(() => {
    clearRecorder();
    setStatus("idle");
    setError(null);
    setAnalysis(null);
    setLevel(0);
    setDuration(0);
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
    const normalized = Math.min(1, rms * 4.5);
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
    const support = describeBrowserSupport();
    if (!support.isSupported) {
      setStatus("error");
      setError(`Browser not supported: ${support.issues.join(" ")}`);
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

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setStatus("error");
        setError("Web Audio API is unavailable in this browser.");
        return;
      }
      let audioContext: AudioContext;
      try {
        audioContext = new AudioContextClass();
      } catch (audioContextError) {
        stream.getTracks().forEach((track) => track.stop());
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
        mediaStreamRef.current = null;
        setStatus("analyzing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
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

          const result = analyzeRecording(audioBuffer);
          setAnalysis(result);
          setStatus("complete");
        } catch (analysisError) {
          setStatus("error");
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : "Unable to analyze recording."
          );
        }
      };
      updateMeter();
      setStatus("idle");
    } catch (permissionError) {
      setStatus("error");
      if (permissionError instanceof DOMException) {
        if (permissionError.name === "NotAllowedError") {
          setError("Microphone permission denied. Please allow access and try again.");
          return;
        }
        if (permissionError.name === "NotFoundError") {
          setError("No microphone detected. Please connect one and try again.");
          return;
        }
      }
      setError(
        permissionError instanceof Error
          ? permissionError.message
          : "Unable to access the microphone."
      );
    }
  }, [clearRecorder, clearStopTimeout, deviceId, minDuration, stopMeter, updateMeter]);

  const startRecording = useCallback(async () => {
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
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }, maxDuration * 1000);
  }, [initializeRecorder, maxDuration, reset, updateMeter]);

  const stopRecording = useCallback(() => {
    clearStopTimeout();

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, [clearStopTimeout]);

  useEffect(() => {
    return () => {
      clearRecorder();
    };
  }, [clearRecorder]);

  return {
    status,
    error,
    analysis,
    level,
    duration,
    initializeRecorder,
    startRecording,
    stopRecording,
    reset
  };
}
