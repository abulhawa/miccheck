"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeRecording } from "../lib/analysis";
import { describeBrowserSupport } from "@miccheck/audio-core";
import type { AnalysisResult } from "../types";

interface RecorderOptions {
  maxDuration?: number;
  minDuration?: number;
}

type RecorderStatus = "idle" | "recording" | "analyzing" | "complete" | "error";

const DEFAULT_MAX_DURATION = 6;
const DEFAULT_MIN_DURATION = 5;

/**
 * useAudioRecorder handles microphone capture, level metering, and analysis.
 */
export function useAudioRecorder({
  maxDuration = DEFAULT_MAX_DURATION,
  minDuration = DEFAULT_MIN_DURATION
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
  const startTimeRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<number | null>(null);
  const updateMeterRef = useRef<() => void>(() => {});

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setAnalysis(null);
    setLevel(0);
    setDuration(0);
    audioChunksRef.current = [];
  }, []);

  const stopMeter = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

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

  const startRecording = useCallback(async () => {
    reset();
    setError(null);

    const support = describeBrowserSupport();
    if (!support.isSupported) {
      setStatus("error");
      setError(`Browser not supported: ${support.issues.join(" ")}`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        setStatus("error");
        setError("Web Audio API is unavailable in this browser.");
        return;
      }
      const audioContext = new AudioContextClass();
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
        stopMeter();
        setStatus("analyzing");
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
          const arrayBuffer = await blob.arrayBuffer();
          const decodeContext = new AudioContextClass();
          const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer.slice(0));
          await decodeContext.close();

          if (audioBuffer.duration < minDuration) {
            setStatus("error");
            setError("Recording was too short. Please capture at least 5 seconds.");
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

      recorder.start();
      startTimeRef.current = performance.now();
      setStatus("recording");
      updateMeter();

      stopTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
      }, maxDuration * 1000);
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
  }, [maxDuration, minDuration, reset, stopMeter, updateMeter]);

  const stopRecording = useCallback(() => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    return () => {
      stopMeter();
      if (stopTimeoutRef.current) {
        window.clearTimeout(stopTimeoutRef.current);
      }
    };
  }, [stopMeter]);

  return {
    status,
    error,
    analysis,
    level,
    duration,
    startRecording,
    stopRecording,
    reset
  };
}
