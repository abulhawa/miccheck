import type { ReactNode } from "react";

type TooltipProps = {
  label: ReactNode;
  text: string;
};

export default function Tooltip({ label, text }: TooltipProps) {
  return (
    <span className="group relative inline-flex cursor-help items-center">
      <span className="border-b border-dashed border-slate-500 text-slate-200">
        {label}
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
