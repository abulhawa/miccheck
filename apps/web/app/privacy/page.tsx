import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how MicCheck handles your microphone recordings and privacy.",
  alternates: {
    canonical: "/privacy"
  }
};

const privacyItems = [
  "No audio uploads. All recording, analysis, and scoring happen locally in your browser.",
  "No account is required and we do not send recorded audio to our servers.",
  "Product analytics are disabled by default. A deployment can explicitly enable Vercel Analytics and Speed Insights; recordings are never included."
];

const audioUseItems = [
  "The guided test captures seven seconds: two seconds of quiet followed by speech. Local AI models run in your browser without an account or API key.",
  "Your latest take and a comparison baseline can be stored with their results in sessionStorage. If storage is unavailable, the app keeps them in memory for the current page.",
  "Starting another test replaces the latest take and preserves a comparison baseline. Clear comparison removes that baseline. Browser session storage normally ends when the tab closes; restored browser sessions may retain it. Saved takes older than 24 hours are not restored.",
  "Model files are served by the same site. Hosting providers may retain ordinary request logs, but the app does not send them your microphone audio."
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Privacy</p>
        <h1 className="text-3xl font-semibold text-white md:text-4xl">MicCheck Privacy Policy</h1>
        <p className="text-sm text-slate-200">MicCheck is designed to keep your audio private.</p>
      </header>

      <section className="space-y-4 text-sm text-slate-200">
        <h2 className="text-lg font-semibold text-white">What We Collect</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-200">
          {privacyItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 text-sm text-slate-200">
        <h2 className="text-lg font-semibold text-white">How Audio Is Used</h2>
        <ul className="list-disc space-y-2 pl-5 text-slate-200">
          {audioUseItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-lg font-semibold text-white">Browser Permissions</h2>
        <p>
          MicCheck requests access to your microphone solely to record the sample. You can
          revoke access at any time through your browser settings.
        </p>
      </section>
    </div>
  );
}
