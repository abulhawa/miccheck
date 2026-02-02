const privacyItems = [
  "No audio uploads. All recording, analysis, and scoring happen locally in your browser.",
  "No personal data storage. We do not store microphone data, identifiers, or recordings."
];

const audioUseItems = [
  "The app captures 5–7 seconds of audio to analyze quality.",
  "Audio data is processed in-memory only.",
  "When you close the tab or refresh, the data is discarded."
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
