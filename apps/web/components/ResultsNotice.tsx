import React from "react";
import type { AnalysisSpecialState, DiagnosticCertainty } from "../types";
import { t } from "../lib/i18n";

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
      {t("results.notice.low_certainty")}
    </section>
  );
}
