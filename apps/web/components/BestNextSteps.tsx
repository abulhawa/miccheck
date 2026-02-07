"use client";

import React, { useEffect, useRef, useState } from "react";
import type { WebVerdict } from "../types";
import { resolveCopy } from "../lib/copy";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import { t } from "../lib/i18n";

interface BestNextStepsProps {
  verdict: WebVerdict;
  mode?: "basic" | "pro";
  maxActionSteps?: number;
  includeGear?: boolean;
  includeSecondaryNotes?: boolean;
  showDiagnosticCertainty?: boolean;
  trackAdviceEvent?: boolean;
}

const useCaseFitNoteKeyFor = (verdict: WebVerdict): string | null => {
  if (verdict.useCaseFit !== "warn") return null;

  if (verdict.primaryIssue === "echo") return "usecase.warn.echo";
  if (verdict.primaryIssue === "noise") return "usecase.warn.noise";
  if (verdict.primaryIssue === "level") return "usecase.warn.level";
  return "usecase.warn.generic";
};

const useCaseFitValueKeyMap = {
  pass: "results.use_case_fit.pass",
  warn: "results.use_case_fit.warn",
  fail: "results.use_case_fit.fail",
  unknown: "results.use_case_fit.unknown"
} as const;

const certaintyValueKeyMap = {
  low: "results.certainty.low",
  medium: "results.certainty.medium",
  high: "results.certainty.high",
  unknown: "results.certainty.unknown"
} as const;

const issueLabelMap = {
  level: "Level",
  noise: "Noise",
  echo: "Echo"
} as const;

const resolveActionTitle = (step?: { title: string; titleKey?: string }) => {
  if (!step) {
    return null;
  }

  if (step.titleKey) {
    return resolveCopy(step.titleKey as never);
  }

  return step.title;
};

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
  const hasPrimaryActionSummary = visibleActionSteps.length > 0;
  const listedActionSteps = hasPrimaryActionSummary ? visibleActionSteps.slice(1) : visibleActionSteps;
  const gearSteps = includeGear
    ? verdict.bestNextSteps?.filter((step) => step.kind === "gear_optional") ?? []
    : [];
  const [showGearLinks, setShowGearLinks] = useState(false);
  const emittedKeyRef = useRef<string | null>(null);

  const gearRecommendations = gearSteps
    .map((step) => step.gear)
    .filter((gear): gear is NonNullable<typeof gearSteps[number]["gear"]> => Boolean(gear));
  const activeGearLinks = gearRecommendations.filter(
    (gear) => gear.linkStatus === "active" && Boolean(gear.affiliateUrl)
  );
  const shouldShowGearCta = activeGearLinks.length > 0;
  const shouldShowNoiseGate =
    verdict.primaryIssue === "noise" && verdict.dimensions.level.descriptionKey === "level.acceptable_noise_first";
  const useCaseFitNoteKey = useCaseFitNoteKeyFor(verdict);

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
      adviceKeys: adviceKeys.join(","),
      mode
    });
    emittedKeyRef.current = emittedKey;
  }, [mode, trackAdviceEvent, verdict.bestNextSteps, verdict.primaryIssue]);

  if (!visibleActionSteps.length && !gearSteps.length) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">{t("results.next_steps.title")}</h2>
      <p className="mt-3 text-sm text-slate-200">
        {resolveActionTitle(visibleActionSteps[0]) ?? resolveCopy(verdict.copyKeys.fixKey)}
        {shouldShowNoiseGate ? ` ${t("advice.noise_fix_before_gain")}` : null}
      </p>
      {shouldShowNoiseGate ? (
        <p className="mt-2 text-xs text-slate-300">{t("level.note_noise_first")}</p>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm text-slate-400">
        <li>
          {t("results.next_steps.use_case_fit_label")}{" "}
          {t(useCaseFitValueKeyMap[verdict.useCaseFit ?? "unknown"])}
        </li>
        {useCaseFitNoteKey ? <li>{t(useCaseFitNoteKey)}</li> : null}
        {showDiagnosticCertainty ? (
          <li>
            {t("results.next_steps.certainty_label")}{" "}
            {t(certaintyValueKeyMap[verdict.diagnosticCertainty ?? "unknown"])}
          </li>
        ) : null}
      </ul>
      {listedActionSteps.length ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {listedActionSteps.map((step) => (
            <li key={`${step.kind}-${step.title}`}>• {resolveActionTitle(step)}</li>
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

      {gearSteps.length ? (
        <div className="mt-4 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
          <p className="font-semibold">{gearSteps[0]?.title}</p>
          {gearRecommendations[0]?.why ? <p className="mt-1 text-blue-200">{gearRecommendations[0].why}</p> : null}
          {shouldShowGearCta ? (
            <button
              className="mt-2 inline-flex items-center gap-1 underline"
              onClick={() => setShowGearLinks((prev) => !prev)}
              type="button"
            >
              {t("affiliate.view_recommended_gear")}
            </button>
          ) : null}
          {shouldShowGearCta ? (
            <p className="mt-2 text-xs text-blue-200">{t("affiliate.disclosure_short")}</p>
          ) : null}
          {showGearLinks ? (
            <div className="mt-3 space-y-3 text-xs text-blue-50">
              {activeGearLinks.length ? (
                activeGearLinks.map((gear) => (
                  <div key={gear.id}>
                    <p className="font-semibold">{gear.title}</p>
                    {gear.why ? <p className="mt-1 text-blue-200">{gear.why}</p> : null}
                    {gear.supportsIssues?.length ? (
                      <p className="mt-1 text-blue-200">
                        Helps with: {gear.supportsIssues.map((issue) => issueLabelMap[issue]).join(", ")}
                      </p>
                    ) : null}
                    {gear.affiliateUrl ? (
                      <a
                        className="mt-1 inline-block underline"
                        href={gear.affiliateUrl}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                      >
                        {t("affiliate.view_recommended_gear")}
                      </a>
                    ) : null}
                  </div>
                ))
              ) : (
                <p>{t("affiliate.empty_state")}</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
