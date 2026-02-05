"use client";

import React, { useEffect, useRef } from "react";
import type { WebVerdict } from "../types";
import { resolveCopy } from "../lib/copy";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";

interface BestNextStepsProps {
  verdict: WebVerdict;
  mode?: "basic" | "pro";
  maxActionSteps?: number;
  includeGear?: boolean;
  includeSecondaryNotes?: boolean;
  showDiagnosticCertainty?: boolean;
  trackAdviceEvent?: boolean;
}

export default function BestNextSteps({
  verdict,
  mode = "pro",
  maxActionSteps,
  includeGear = true,
  includeSecondaryNotes = true,
  showDiagnosticCertainty = true,
  trackAdviceEvent = true
}: BestNextStepsProps) {
  const actionSteps = verdict.bestNextSteps?.filter((step) => step.kind === "action") ?? [];
  const visibleActionSteps = typeof maxActionSteps === "number" ? actionSteps.slice(0, maxActionSteps) : actionSteps;
  const gearStep = includeGear
    ? verdict.bestNextSteps?.find((step) => step.kind === "gear_optional")
    : undefined;
  const emittedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!trackAdviceEvent) {
      return;
    }

    const adviceKeys = (verdict.bestNextSteps ?? []).map((step) => step.kind);
    if (!adviceKeys.length) {
      return;
    }

    const emittedKey = JSON.stringify({ adviceKeys, mode, primaryIssue: verdict.primaryIssue });
    if (emittedKeyRef.current === emittedKey) {
      return;
    }

    logEvent(ANALYTICS_EVENTS.adviceEmitted, {
      primaryIssue: verdict.primaryIssue ?? "unknown",
      adviceKeys,
      mode
    });
    emittedKeyRef.current = emittedKey;
  }, [mode, trackAdviceEvent, verdict.bestNextSteps, verdict.primaryIssue]);

  if (!visibleActionSteps.length && !gearStep) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">🎯 Best Next Step</h2>
      <p className="mt-3 text-sm text-slate-200">
        {visibleActionSteps[0]?.title ?? resolveCopy(verdict.copyKeys.fixKey)}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-400">
        <li>Use case fit: {verdict.useCaseFit ?? "unknown"}</li>
        {showDiagnosticCertainty ? (
          <li>Diagnostic certainty: {verdict.diagnosticCertainty ?? "unknown"}</li>
        ) : null}
      </ul>
      {visibleActionSteps.length ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {visibleActionSteps.map((step) => (
            <li key={`${step.kind}-${step.title}`}>• {step.title}</li>
          ))}
        </ul>
      ) : null}

      {includeSecondaryNotes && verdict.secondaryNotes?.length ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {verdict.secondaryNotes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
        </ul>
      ) : null}

      {gearStep ? (
        <div className="mt-4 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <p className="font-semibold">{gearStep.title}</p>
          {gearStep.gear?.rationale ? <p className="mt-1 text-blue-200">{gearStep.gear.rationale}</p> : null}
          {gearStep.gear?.affiliateUrl ? (
            <a
              className="mt-2 inline-block underline"
              href={gearStep.gear.affiliateUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              View recommended gear
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
