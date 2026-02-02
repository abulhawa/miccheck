"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseAudioPlaybackProps {
  audioBlob: Blob | null;
  onTimeUpdate?: (currentTime: number) => void;
  onPlaybackEnd?: () => void;
}

interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * useAudioPlayback manages an <audio> element with smooth time updates
 * and proper cleanup of object URLs created from recorded blobs.
 */
export const useAudioPlayback = ({
  audioBlob,
  onTimeUpdate,
  onPlaybackEnd
}: UseAudioPlaybackProps): UseAudioPlaybackReturn => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const updateCurrentTimeRef = useRef<() => void>(() => {});

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const resetPlaybackState = useCallback(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const updateCurrentTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = audio.currentTime;
    setCurrentTime(nextTime);
    onTimeUpdate?.(nextTime);

    if (!audio.paused) {
      animationRef.current = requestAnimationFrame(() => updateCurrentTimeRef.current());
    }
  }, [onTimeUpdate]);

  useEffect(() => {
    updateCurrentTimeRef.current = updateCurrentTime;
  }, [updateCurrentTime]);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const handleLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      cancelAnimation();
      audio.currentTime = 0;
      setCurrentTime(0);
      onPlaybackEnd?.();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      cancelAnimation();
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [cancelAnimation, onPlaybackEnd, onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioBlob) {
      audio.removeAttribute("src");
      audio.load();
      queueMicrotask(resetPlaybackState);
      return;
    }

    const objectUrl = URL.createObjectURL(audioBlob);
    objectUrlRef.current = objectUrl;
    audio.src = objectUrl;
    audio.load();
    queueMicrotask(resetPlaybackState);

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [audioBlob, resetPlaybackState]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setIsPlaying(true);
      cancelAnimation();
      animationRef.current = requestAnimationFrame(() => updateCurrentTimeRef.current());
    } catch {
      setIsPlaying(false);
      cancelAnimation();
    }
  }, [cancelAnimation]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    cancelAnimation();
  }, [cancelAnimation]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    cancelAnimation();
  }, [cancelAnimation]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const nextTime = clamp(time, 0, duration || 0);
      audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      onTimeUpdate?.(nextTime);
    },
    [duration, onTimeUpdate]
  );

  return {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    stop,
    seek
  };
};
