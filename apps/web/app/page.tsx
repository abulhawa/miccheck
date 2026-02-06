import Link from "next/link";

import BrowserSupport from "../components/BrowserSupport";
import { buttonStyles } from "../components/buttonStyles";

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
          <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
            MicCheck
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Check your microphone quality in 7 seconds.
          </h1>
          <p className="text-base text-slate-200 md:text-lg">
            Record a quick sample, get an instant grade, and fix the biggest issue in
            your setup. Everything happens locally in your browser.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              className={buttonStyles({ variant: "primary", className: "text-center" })}
              href="/pro"
            >
              Start a test
            </Link>
            <Link
              className={buttonStyles({ variant: "secondary", className: "text-center" })}
              href="/results"
            >
              View sample results
            </Link>
          </div>
          <p className="text-xs text-slate-200">
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
                <p className="text-sm text-slate-400">A–F score based on the weakest category.</p>
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

      <div className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-6 text-center text-sm text-slate-700">
        <strong>Your privacy is protected.</strong> Audio is processed locally in your browser.
        <span className="block">Nothing is uploaded, stored, or sent to our servers.</span>
        <Link className="mt-2 inline-flex text-xs font-semibold text-blue-700 underline" href="/privacy">
          Read the privacy policy
        </Link>
      </div>

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
