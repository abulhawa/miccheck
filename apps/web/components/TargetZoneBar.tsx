import type { VerdictTargetMetadata } from "../types";

interface TargetZoneBarProps {
  target?: VerdictTargetMetadata;
}

const markerClasses: Record<NonNullable<VerdictTargetMetadata["marker"]>, string> = {
  low: "left-[16%]",
  ideal: "left-1/2",
  high: "left-[84%]"
};

export default function TargetZoneBar({ target }: TargetZoneBarProps) {
  const resolved =
    target ??
    ({ lowLabel: "Low", idealLabel: "Ideal", highLabel: "High", marker: "ideal" } as const);

  return (
    <div>
      <div className="relative mt-2 h-2 rounded-full bg-slate-800">
        <div className="absolute inset-y-0 left-1/3 right-1/3 rounded-full bg-emerald-500/70" />
        <div
          className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-brand-500 ${markerClasses[resolved.marker]}`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] uppercase tracking-wide text-slate-400">
        <span>{resolved.lowLabel}</span>
        <span>{resolved.idealLabel}</span>
        <span>{resolved.highLabel}</span>
      </div>
    </div>
  );
}
