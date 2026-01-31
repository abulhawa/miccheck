"use client";

import { useCallback } from "react";
import type { ChangeEvent } from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onReplay: () => void;
  onSeek: (time: number) => void;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = Math.floor(safeSeconds % 60);
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

export default function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onReplay,
  onSeek
}: PlaybackControlsProps) {
  const handleRangeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextTime = Number(event.target.value);
      onSeek(nextTime);
    },
    [onSeek]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
          onClick={isPlaying ? onPause : onPlay}
          type="button"
          aria-label={isPlaying ? "Pause playback" : "Play recording"}
        >
          {isPlaying ? "⏸ Pause" : "▶ Play"}
        </button>
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
          onClick={onStop}
          type="button"
          aria-label="Stop playback"
        >
          ⏹ Stop
        </button>
        <button
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
          onClick={onReplay}
          type="button"
          aria-label="Replay recording"
        >
          🔁 Replay
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-brand-500"
          min={0}
          max={duration || 0}
          step={0.01}
          type="range"
          value={Math.min(currentTime, duration || 0)}
          onChange={handleRangeChange}
          aria-label="Seek through recording"
        />
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
