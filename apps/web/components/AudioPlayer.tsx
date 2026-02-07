"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PlaybackControls from "./PlaybackControls";
import WaveformWithPlayhead from "./WaveformWithPlayhead";
import { useAudioPlayback } from "../hooks/useAudioPlayback";
import { t } from "../lib/i18n";

interface AudioPlayerProps {
  audioBlob: Blob;
  waveformData?: Float32Array;
  showWaveform?: boolean;
  autoPlay?: boolean;
  onPlaybackComplete?: () => void;
}

const createWaveformData = (buffer: AudioBuffer, points = 180) => {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / points);
  const filtered = new Float32Array(points);

  for (let i = 0; i < points; i += 1) {
    let sum = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    for (let j = start; j < end; j += 1) {
      sum += Math.abs(channelData[j]);
    }
    filtered[i] = sum / (end - start || 1);
  }

  return filtered;
};

export default function AudioPlayer({
  audioBlob,
  waveformData,
  showWaveform = true,
  autoPlay = false,
  onPlaybackComplete
}: AudioPlayerProps) {
  const [derivedWaveform, setDerivedWaveform] = useState<Float32Array | null>(null);
  const [waveformError, setWaveformError] = useState<string | null>(null);

  const { isPlaying, currentTime, duration, play, pause, stop, seek } = useAudioPlayback({
    audioBlob,
    onPlaybackEnd: onPlaybackComplete
  });

  const progress = useMemo(() => (duration ? currentTime / duration : 0), [currentTime, duration]);
  const displayWaveform = waveformData ?? derivedWaveform;
  const displayWaveformError = waveformData ? null : waveformError;

  useEffect(() => {
    let isActive = true;

    const decodeWaveform = async () => {
      setWaveformError(null);
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const AudioContextClass = window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          setWaveformError(t("audio.playback.waveform_unavailable"));
          return;
        }
        const audioContext = new AudioContextClass();
        const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const waveform = createWaveformData(decoded);
        await audioContext.close();

        if (isActive) {
          setDerivedWaveform(waveform);
        }
      } catch (error) {
        if (isActive) {
          setWaveformError(
            error instanceof Error
              ? error.message
              : t("audio.playback.waveform_failed")
          );
        }
      }
    };

    if (!waveformData) {
      void decodeWaveform();
    }

    return () => {
      isActive = false;
    };
  }, [audioBlob, waveformData]);

  useEffect(() => {
    if (!autoPlay) return;
    void play();
  }, [autoPlay, play]);

  const handleReplay = useCallback(() => {
    stop();
    void play();
  }, [play, stop]);

  const handleSeek = useCallback(
    (nextProgress: number) => {
      if (!duration) return;
      seek(nextProgress * duration);
    },
    [duration, seek]
  );

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-slate-200">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-base font-semibold">{t("audio.playback.title")}</h3>
          <p className="mt-1 text-xs text-slate-400">
            {t("audio.playback.subtitle")}
          </p>
        </div>

        {showWaveform ? (
          <div className="rounded-2xl bg-slate-900/80 p-3">
            <WaveformWithPlayhead
              waveformData={displayWaveform}
              progress={progress}
              onSeek={handleSeek}
            />
            {displayWaveformError ? (
              <p className="mt-2 text-xs text-rose-200">{displayWaveformError}</p>
            ) : null}
          </div>
        ) : null}

        <PlaybackControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          onPlay={() => void play()}
          onPause={pause}
          onStop={stop}
          onReplay={handleReplay}
          onSeek={seek}
        />

        <div className="text-xs text-slate-200">
          {t("audio.playback.memory_notice")}
        </div>
      </div>
    </div>
  );
}
