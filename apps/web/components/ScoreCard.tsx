import React from "react";
import { toStarRating } from "../lib/starRating";
import type { MetricsSummary, WebVerdict } from "../types";
import { resolveCopy } from "../lib/copy";
import { t } from "../lib/i18n";
import {
  formatClippingMetric,
  formatEchoMetric,
  formatLevelMetric,
  formatNoiseMetric
} from "../lib/metricFormatting";
import ShareButton from "./ShareButton";

interface ScoreCardProps {
  verdict: WebVerdict;
  metrics: MetricsSummary;
  highlightedCategoryId?: WebVerdict["primaryIssue"];
}

const renderStars = (count: number): string => "★".repeat(count) + "☆".repeat(5 - count);

export default function ScoreCard({ verdict, metrics, highlightedCategoryId }: ScoreCardProps) {
  const activeHighlight = highlightedCategoryId ?? verdict.primaryIssue;
  const hasHighlight = Boolean(activeHighlight);
  const gradeLabel = resolveCopy(verdict.overall.labelKey);
  const explanationLabel = resolveCopy(verdict.copyKeys.explanationKey);
  const impactLabel = resolveCopy(verdict.copyKeys.impactKey);
  const shouldShowExplanation =
    !(verdict.overall.grade === "A" && explanationLabel === gradeLabel);
  const clippingPercent = metrics.clippingRatio * 100;
  const isNegligibleClipping =
    verdict.overall.grade === "A" && clippingPercent > 0 && clippingPercent <= 0.5;
  const clippingText = isNegligibleClipping
    ? t("clipping.negligible", { pct: clippingPercent.toFixed(1) })
    : formatClippingMetric(metrics);
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
            {shouldShowExplanation ? (
              <span className="text-sm font-medium text-slate-200">– {explanationLabel}</span>
            ) : null}
          </p>
          <div className="mt-3">
            <ShareButton grade={verdict.overall.grade} />
          </div>
          <p className="mt-2 text-sm text-slate-200">
            {resolveCopy(verdict.copyKeys.impactSummaryKey, { impact: impactLabel })}
          </p>
          <p className="mt-2 text-sm text-slate-200">{resolveCopy(verdict.overall.summaryKey)}</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {categoryEntries.map(([categoryKey, category]) => {
          const rating = toStarRating({
            stars: category.stars,
            descriptionKey: category.descriptionKey
          });

          const metricText =
            categoryKey === "level"
              ? formatLevelMetric(metrics)
              : categoryKey === "noise"
                ? formatNoiseMetric(metrics)
                : formatEchoMetric(metrics);

          return (
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
              <p className="text-sm font-semibold text-slate-100">{resolveCopy(category.labelKey)}</p>
              <p className="mt-2 text-lg tracking-wider text-amber-300" aria-label={`${rating.stars} stars`}>
                {renderStars(rating.stars)}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-300">{rating.label}</p>
              <p className="mt-2 text-xs text-slate-400">{resolveCopy(category.descriptionKey)}</p>
              <p className="mt-2 text-xs font-medium text-slate-200">{metricText}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-sm font-semibold text-slate-100">{resolveCopy("ui.metric.clipping")}</p>
        <p className="mt-2 text-xs font-medium text-slate-200">{clippingText}</p>
      </div>
    </div>
  );
}
