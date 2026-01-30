import Link from "next/link";
import ScoreCard from "../../components/ScoreCard";
import type { AnalysisResult } from "../../types";

const sampleResult: AnalysisResult = {
  grade: "B",
  summary: "Strong overall sound with mild room reflections.",
  categories: {
    level: { stars: 4, label: "Level", description: "Healthy speaking level" },
    noise: { stars: 5, label: "Noise", description: "Quiet background" },
    room: { stars: 3, label: "Room", description: "Some room echo present" }
  },
  metrics: {
    clippingRatio: 0.003,
    rmsDb: -16.5,
    snrDb: 26.2,
    humRatio: 0.04,
    echoScore: 0.32
  },
  recommendation: {
    category: "Room",
    message: "Add soft furnishings or move closer to the mic to reduce echo.",
    confidence: 0.78
  }
};

export default function ResultsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-3xl font-semibold">Sample results</h1>
        <p className="mt-2 text-sm text-slate-300">
          This is a preview of the insights you&apos;ll receive after recording.
        </p>
      </section>

      <ScoreCard result={sampleResult} />

      <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-semibold">What the metrics mean</h2>
        <ul className="mt-3 space-y-2">
          <li>
            Level: target around -14 dBFS, acceptable range roughly -26 to -6
            dBFS.
          </li>
          <li>Noise: higher SNR means a cleaner background.</li>
          <li>Room: echo score rises with reflections or large rooms.</li>
        </ul>
        <Link
          className="mt-6 inline-flex rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          href="/test"
        >
          Run your own test
        </Link>
      </section>
    </div>
  );
}
