"use client";

import { useMemo } from "react";

export interface AudioVisualizerProps {
  level: number;
  isRecording: boolean;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export default function AudioVisualizer({ level, isRecording }: AudioVisualizerProps) {
  const clampedLevel = useMemo(() => clamp(level), [level]);
  const hasAudio = clampedLevel > 0;
  const height = !isRecording && !hasAudio ? 5 : clampedLevel * 100;
  const label = isRecording ? "Listening…" : "Idle";
  const barClasses = hasAudio
    ? "bg-gradient-to-t from-emerald-400 via-emerald-500 to-emerald-200"
    : "bg-gray-300";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span>Input level</span>
          <span className={!hasAudio ? "animate-pulse text-slate-200" : "text-emerald-300"}>
            <svg
              aria-hidden="true"
              focusable="false"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M6 10a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
            </svg>
          </span>
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-4 h-24 rounded-2xl bg-slate-900/80 p-3">
        <div className="relative h-full overflow-hidden rounded-xl bg-slate-800">
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-xl transition-all duration-150 ${barClasses}`}
            style={{ height: `${height}%`, opacity: isRecording ? 1 : 0.4 }}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-200">
        Aim for peaks in the upper green zone without hitting the top.
      </p>
    </div>
  );
}
