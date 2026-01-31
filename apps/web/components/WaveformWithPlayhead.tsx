"use client";

import { useCallback, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

interface WaveformWithPlayheadProps {
  waveformData: Float32Array | null;
  progress: number;
  onSeek?: (progress: number) => void;
}

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export default function WaveformWithPlayhead({
  waveformData,
  progress,
  onSeek
}: WaveformWithPlayheadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(progress);
  const dataRef = useRef(waveformData);

  useEffect(() => {
    progressRef.current = progress;
    dataRef.current = waveformData;
  }, [progress, waveformData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      const data = dataRef.current;
      const playProgress = clamp(progressRef.current);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      if (data && data.length > 0) {
        const centerY = height / 2;
        const sliceWidth = width / data.length;

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.6)";
        ctx.beginPath();

        let x = 0;
        for (let i = 0; i < data.length; i += 1) {
          const sample = data[i];
          const y = centerY - sample * centerY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();

        const playedWidth = width * playProgress;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, playedWidth, height);
        ctx.clip();
        ctx.strokeStyle = "rgba(94, 234, 212, 0.9)";
        ctx.beginPath();

        x = 0;
        for (let i = 0; i < data.length; i += 1) {
          const sample = data[i];
          const y = centerY - sample * centerY;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = "rgba(94, 234, 212, 0.2)";
        ctx.fillRect(0, 0, playedWidth, height);
      } else {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      const playheadX = width * playProgress;
      ctx.strokeStyle = "rgba(244, 114, 182, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    };

    draw();
  }, [progress, waveformData]);

  const handleSeek = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!onSeek) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const nextProgress = clamp(clickX / rect.width);
      onSeek(nextProgress);
    },
    [onSeek]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!onSeek) return;
      const delta = event.key === "ArrowRight" ? 0.05 : event.key === "ArrowLeft" ? -0.05 : 0;
      if (delta === 0) return;
      event.preventDefault();
      onSeek(clamp(progress + delta));
    },
    [onSeek, progress]
  );

  return (
    <button
      className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
      type="button"
      onClick={handleSeek}
      onKeyDown={handleKeyDown}
      aria-label="Seek within the waveform"
    >
      <canvas ref={canvasRef} width={640} height={120} className="h-full w-full" />
    </button>
  );
}
