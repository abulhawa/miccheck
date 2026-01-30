import Link from "next/link";

import BrowserSupport from "../components/BrowserSupport";

const features = [
  {
    title: "Local analysis",
    description: "All audio processing stays on-device for privacy and speed."
  },
  {
    title: "Actionable feedback",
    description: "Get a letter grade plus the single best fix to improve quality."
  },
  {
    title: "Browser-friendly",
    description: "Supports Chrome, Edge, Firefox, and Safari on desktop + mobile."
  }
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
            MicCheck
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Check your microphone quality in under 60 seconds.
          </h1>
          <p className="text-base text-slate-300 md:text-lg">
            Record a quick sample, get an instant grade, and fix the biggest issue in
            your setup. Everything happens locally in your browser.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              className="rounded-xl bg-brand-500 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-brand-700"
              href="/test"
            >
              Start a test
            </Link>
            <Link
              className="rounded-xl border border-slate-700 px-6 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-slate-500"
              href="/results"
            >
              View sample results
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            We never upload audio. Review our privacy policy anytime.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg">
          <h2 className="text-lg font-semibold">What you&apos;ll get</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-3 w-3 rounded-full bg-emerald-400" />
              <div>
                <p className="font-medium">Letter grade</p>
                <p className="text-sm text-slate-400">A-F score based on the weakest category.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-3 w-3 rounded-full bg-amber-400" />
              <div>
                <p className="font-medium">Category stars</p>
                <p className="text-sm text-slate-400">Level, noise, and echo performance.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-3 w-3 rounded-full bg-sky-400" />
              <div>
                <p className="font-medium">One fix</p>
                <p className="text-sm text-slate-400">Focused recommendation to improve fast.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
              Privacy promise
            </p>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Your audio stays on your device.
            </h2>
            <p className="text-sm text-sky-100/80">
              MicCheck runs 100% in your browser. No audio is uploaded.
            </p>
          </div>
          <Link
            className="w-fit rounded-full border border-sky-200/40 bg-sky-500/20 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500/30"
            href="/docs/PRIVACY.md"
          >
            Read the privacy policy
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"
          >
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
          </div>
        ))}
      </section>

      <BrowserSupport />
    </div>
  );
}
