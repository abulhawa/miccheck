import React from "react";
import type { AnalysisSpecialState, DiagnosticCertainty } from "../types";

interface ResultsNoticeProps {
  specialState?: AnalysisSpecialState;
  diagnosticCertainty?: DiagnosticCertainty;
}

export default function ResultsNotice({ specialState, diagnosticCertainty }: ResultsNoticeProps) {
  const shouldShowNotice = specialState === "NO_SPEECH" || diagnosticCertainty === "low";

  if (!shouldShowNotice) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      Results may be less reliable — try again in a quieter environment.
    </section>
  );
}
