import React from "react";
import type { WebVerdict } from "../types";
import { resolveCopy } from "../lib/copy";

interface BestNextStepsProps {
  verdict: WebVerdict;
}

export default function BestNextSteps({ verdict }: BestNextStepsProps) {
  const actionSteps = verdict.bestNextSteps?.filter((step) => step.kind === "action") ?? [];
  const gearStep = verdict.bestNextSteps?.find((step) => step.kind === "gear_optional");

  if (!actionSteps.length && !gearStep) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">🎯 Best Next Step</h2>
      <p className="mt-3 text-sm text-slate-200">
        {actionSteps[0]?.title ?? resolveCopy(verdict.copyKeys.fixKey)}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-400">
        <li>Use case fit: {verdict.useCaseFit ?? "unknown"}</li>
        <li>Diagnostic certainty: {verdict.diagnosticCertainty ?? "unknown"}</li>
      </ul>
      {actionSteps.length ? (
        <ul className="mt-4 space-y-2 text-sm text-slate-300">
          {actionSteps.map((step) => (
            <li key={`${step.kind}-${step.title}`}>• {step.title}</li>
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
