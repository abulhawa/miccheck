"use client";

import { useEffect, useRef, useState } from "react";

interface AudioMeterOptions {
  stream: MediaStream | null;
  isActive: boolean;
}

interface AudioMeterState {
  audioDataArray: Float32Array | null;
  currentVolume: number;
  peakVolume: number;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export function useAudioMeter({ stream, isActive }: AudioMeterOptions): AudioMeterState {
  const [audioDataArray, setAudioDataArray] = useState<Float32Array | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive || !stream) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioDataArray(null);
      setCurrentVolume(0);
      setPeakVolume(0);
      return;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setAudioDataArray(null);
      setCurrentVolume(0);
      setPeakVolume(0);
      return;
    }

    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;
    void audioContext.resume();

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
    setAudioDataArray(dataArray);
    setPeakVolume(0);

    const update = () => {
      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (const value of dataArray) {
        sum += value * value;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const normalized = clamp(rms * 4.25);

      setCurrentVolume(normalized);
      setPeakVolume((previous) => Math.max(previous, normalized));
      animationRef.current = requestAnimationFrame(update);
    };

    update();

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      source.disconnect();
      analyser.disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isActive, stream]);

  return { audioDataArray, currentVolume, peakVolume };
}
