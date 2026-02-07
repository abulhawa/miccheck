"use client";

import React, { useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";

interface ShareButtonProps {
  grade: string;
}

export default function ShareButton({ grade }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "https://miccheck-sage.vercel.app");
  const shareText = `My microphone scored ${grade} on MicCheck! Test yours: ${baseUrl}`;
  const shareLabel = grade === "A" ? t("results.share.excellent") : "Share";

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const handleShare = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(shareText);
      setStatus("copied");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setStatus("idle"), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleShare}
        className="rounded-full border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:border-amber-400 hover:text-amber-200"
      >
        {shareLabel}
      </button>
      {status === "copied" ? (
        <span className="text-xs font-medium text-emerald-300">Copied</span>
      ) : null}
      {status === "error" ? (
        <span className="text-xs font-medium text-red-300">Copy failed</span>
      ) : null}
    </div>
  );
}
