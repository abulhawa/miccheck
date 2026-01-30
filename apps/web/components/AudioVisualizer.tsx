"use client";

import { useMemo } from "react";

export interface AudioVisualizerProps {
  level: number;
  isRecording: boolean;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export default function AudioVisualizer({ level, isRecording }: AudioVisualizerProps) {
  const height = useMemo(() => clamp(level) * 100, [level]);
  const label = isRecording ? "Listening…" : "Idle";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Input level</span>
        <span>{label}</span>
      </div>
      <div className="mt-4 h-24 rounded-2xl bg-slate-900/80 p-3">
        <div className="relative h-full overflow-hidden rounded-xl bg-slate-800">
          <div
            className="absolute bottom-0 left-0 right-0 rounded-xl bg-gradient-to-t from-emerald-400 via-emerald-500 to-emerald-200 transition-all duration-150"
            style={{ height: `${height}%`, opacity: isRecording ? 1 : 0.4 }}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Aim for peaks in the upper green zone without hitting the top.
      </p>
    </div>
  );
}
