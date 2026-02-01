import type { AnalysisResult } from "../types";
import ShareButton from "./ShareButton";

interface ScoreCardProps {
  result: AnalysisResult;
  highlightedCategoryId?: AnalysisResult["primaryIssueCategory"];
}

const starArray = (stars: number) => Array.from({ length: 5 }, (_, i) => i < stars);
const LEVEL_TARGET_DB = -14;
const categoryImpactMap: Record<AnalysisResult["primaryIssueCategory"], string> = {
  level: "recording level",
  noise: "background noise",
  echo: "echo",
  clipping: "clipping"
};
const gradeLabelMap: Record<AnalysisResult["grade"], string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Needs Improvement",
  E: "Needs Improvement",
  F: "Unusable",
};
export default function ScoreCard({ result, highlightedCategoryId }: ScoreCardProps) {
  // Map star scores to user-facing descriptors per category requirements.
  const getDescriptorForScore = (score: number, category: "level" | "noise" | "echo") => {
    if (category === "level") {
      if (score >= 5) {
        return "Perfect level";
      }
      if (score === 4) {
        return "Excellent level";
      }
      if (score === 3) {
        return "Slightly off target";
      }
      return result.metrics.speechRmsDb <= LEVEL_TARGET_DB ? "Too quiet" : "Too loud";
    }
    if (category === "echo") {
      if (score >= 5) {
        return "Minimal echo";
      }
      if (score === 4) {
        return "Slight reflections";
      }
      if (score === 3) {
        return "Some room echo";
      }
      return "Strong echo";
    }

    if (score >= 5) {
      return "Perfect";
    }
    if (score === 4) {
      return "Excellent";
    }
    if (score === 3) {
      return "Adequate";
    }
    if (score === 2) {
      return "Needs work";
    }
    return "Poor";
  };
  const activeHighlight =
    highlightedCategoryId ?? (result.primaryIssueCategory === "clipping" ? undefined : result.primaryIssueCategory);
  const hasHighlight = Boolean(activeHighlight);
  const gradeLabel = gradeLabelMap[result.grade] ?? "Needs Improvement";
  const impactLabel = categoryImpactMap[result.primaryIssueCategory] ?? "overall audio quality";
  const categoryEntries = (
    Object.entries(result.categories ?? {}) as Array<
      [
        keyof AnalysisResult["categories"],
        AnalysisResult["categories"][keyof AnalysisResult["categories"]] | undefined
      ]
    >
  ).filter(
    (
      entry
    ): entry is [
      keyof AnalysisResult["categories"],
      AnalysisResult["categories"][keyof AnalysisResult["categories"]]
    ] => Boolean(entry[1])
  );

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overall grade</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-2 text-2xl font-semibold text-white sm:text-3xl">
            <span>{gradeLabel}</span>
            <span className="text-sm font-medium text-slate-400">({result.grade})</span>
            <span className="text-sm font-medium text-slate-300">– {result.explanation}</span>
          </p>
          <div className="mt-3">
            <ShareButton grade={result.grade} />
          </div>
          <p className="mt-2 text-sm text-slate-200">
            Your grade is mainly affected by {impactLabel}.
          </p>
          <p className="mt-2 text-sm text-slate-300">{result.summary}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
          <p>Clipping: {(result.metrics.clippingRatio * 100).toFixed(2)}%</p>
          <p>RMS: {result.metrics.rmsDb.toFixed(1)} dBFS</p>
          <p>SNR: {result.metrics.snrDb.toFixed(1)} dB</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {categoryEntries.map(([categoryKey, category]) => (
          <div
            key={category.label}
            className={`rounded-2xl border border-slate-800 bg-slate-950/40 p-4 ${
              activeHighlight === categoryKey
                ? "ring-2 ring-amber-500"
                : hasHighlight
                  ? "opacity-80"
                  : ""
            }`}
          >
            <p className="text-sm font-semibold text-slate-100">{category.label}</p>
            <div className="mt-2 flex gap-1">
              {starArray(category.stars).map((filled, index) => (
                <span
                  key={`${category.label}-star-${index}`}
                  className={
                    filled
                      ? "text-amber-400"
                      : "text-slate-700"
                  }
                >
                  ★
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {getDescriptorForScore(category.stars, categoryKey)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
