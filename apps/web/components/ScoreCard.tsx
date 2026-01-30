import type { AnalysisResult } from "../types";

interface ScoreCardProps {
  result: AnalysisResult;
}

const starArray = (stars: number) => Array.from({ length: 5 }, (_, i) => i < stars);
const LEVEL_TARGET_DB = -14;

export default function ScoreCard({ result }: ScoreCardProps) {
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
      return result.metrics.rmsDb <= LEVEL_TARGET_DB ? "Too quiet" : "Too loud";
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

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overall grade</p>
          <p className="text-4xl font-semibold text-white">{result.grade}</p>
          <p className="mt-2 text-sm text-slate-300">{result.summary}</p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
          <p>Clipping: {(result.metrics.clippingRatio * 100).toFixed(2)}%</p>
          <p>RMS: {result.metrics.rmsDb.toFixed(1)} dBFS</p>
          <p>SNR: {result.metrics.snrDb.toFixed(1)} dB</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(
          Object.entries(result.categories) as Array<
            [
              keyof AnalysisResult["categories"],
              AnalysisResult["categories"][keyof AnalysisResult["categories"]]
            ]
          >
        ).map(([categoryKey, category]) => (
          <div key={category.label} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
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
              {getDescriptorForScore(
                category.stars,
                categoryKey === "room" ? "echo" : categoryKey
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
