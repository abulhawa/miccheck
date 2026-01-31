"use client";

import { useEffect, useMemo, useRef } from "react";

export interface AudioWaveformVisualizerProps {
  audioDataArray: Float32Array | null;
  currentVolume: number;
  peakVolume: number;
  isRecording: boolean;
  width?: number;
  height?: number;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export default function AudioWaveformVisualizer({
  audioDataArray,
  currentVolume,
  peakVolume,
  isRecording,
  width = 640,
  height = 120
}: AudioWaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef<Float32Array | null>(audioDataArray);
  const volumeRef = useRef({ currentVolume, peakVolume, isRecording });

  useEffect(() => {
    dataRef.current = audioDataArray;
  }, [audioDataArray]);

  useEffect(() => {
    volumeRef.current = { currentVolume, peakVolume, isRecording };
  }, [currentVolume, peakVolume, isRecording]);

  const gradientStops = useMemo(
    () => [
      { offset: 0, color: "#22c55e" },
      { offset: 0.6, color: "#facc15" },
      { offset: 1, color: "#f97316" }
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      const { currentVolume: liveVolume, peakVolume: livePeak, isRecording: liveRecording } =
        volumeRef.current;
      const data = dataRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      const zoneGradient = ctx.createLinearGradient(0, height, 0, 0);
      gradientStops.forEach(({ offset, color }) => zoneGradient.addColorStop(offset, color));
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = zoneGradient;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      ctx.lineWidth = 2;
      ctx.strokeStyle = zoneGradient;
      ctx.beginPath();

      if (data && data.length > 0 && liveRecording) {
        const sliceWidth = width / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i += 1) {
          const sample = data[i];
          const y = (0.5 - sample / 2) * height;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
      } else {
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
      }

      ctx.stroke();

      if (data && data.length > 0 && liveRecording) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = zoneGradient;
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const peak = clamp(livePeak);
      if (peak > 0) {
        const peakY = height - peak * height;
        ctx.strokeStyle = "rgba(248, 113, 113, 0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, peakY);
        ctx.lineTo(width, peakY);
        ctx.stroke();
      }

      if (!liveRecording) {
        ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
        ctx.font = "12px ui-sans-serif";
        ctx.fillText("Idle", 12, 18);
      } else {
        const normalized = clamp(liveVolume);
        const meterX = width - 12;
        const meterHeight = Math.max(4, normalized * height);
        ctx.fillStyle = "rgba(94, 234, 212, 0.9)";
        ctx.fillRect(meterX, height - meterHeight, 4, meterHeight);
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gradientStops, height, width]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span>Input waveform</span>
          <span className={isRecording ? "text-emerald-300" : "text-slate-500"}>
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M6 10a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 10a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
            </svg>
          </span>
        </span>
        <span>{isRecording ? "Listening…" : "Idle"}</span>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-900/80 p-3">
        <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          <canvas ref={canvasRef} width={width} height={height} className="h-full w-full" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Peaks are marked in red—aim for a strong signal without touching the ceiling.
      </p>
    </div>
  );
}
