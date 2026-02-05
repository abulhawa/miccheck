import type { WebVerdict } from "../types";
import { resolveCopy } from "../lib/copy";
import ShareButton from "./ShareButton";
import TargetZoneBar from "./TargetZoneBar";

interface ScoreCardProps {
  verdict: WebVerdict;
  highlightedCategoryId?: WebVerdict["primaryIssue"];
}

export default function ScoreCard({ verdict, highlightedCategoryId }: ScoreCardProps) {
  const activeHighlight = highlightedCategoryId ?? verdict.primaryIssue;
  const hasHighlight = Boolean(activeHighlight);
  const gradeLabel = resolveCopy(verdict.overall.labelKey);
  const impactLabel = resolveCopy(verdict.copyKeys.impactKey);
  const categoryEntries = (
    Object.entries(verdict.dimensions) as Array<
      [
        keyof WebVerdict["dimensions"],
        WebVerdict["dimensions"][keyof WebVerdict["dimensions"]]
      ]
    >
  );

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-200">
            {resolveCopy("ui.overall_grade")}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2 text-2xl font-semibold text-white sm:text-3xl">
            <span>{gradeLabel}</span>
            <span className="text-sm font-medium text-slate-400">({verdict.overall.grade})</span>
            <span className="text-sm font-medium text-slate-200">
              – {resolveCopy(verdict.copyKeys.explanationKey)}
            </span>
          </p>
          <div className="mt-3">
            <ShareButton grade={verdict.overall.grade} />
          </div>
          <p className="mt-2 text-sm text-slate-200">
            {resolveCopy(verdict.copyKeys.impactSummaryKey, { impact: impactLabel })}
          </p>
          <p className="mt-2 text-sm text-slate-200">
            {resolveCopy(verdict.overall.summaryKey)}
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {categoryEntries.map(([categoryKey, category]) => (
          <div
            key={category.labelKey}
            className={`rounded-2xl border border-slate-800 bg-slate-950/40 p-4 ${
              activeHighlight === categoryKey
                ? "ring-2 ring-amber-500"
                : hasHighlight
                  ? "opacity-80"
                  : ""
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">
              {resolveCopy(category.labelKey)}
            </p>
            <TargetZoneBar target={category.target} />
            <p className="mt-2 text-xs text-slate-400">
              {resolveCopy(category.descriptionKey)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
