const browserRows = [
  {
    browser: "Chrome / Edge (desktop)",
    status: "✅ Full",
    notes: "Best experience"
  },
  {
    browser: "Firefox (desktop)",
    status: "⚠️ Partial",
    notes: "Minor quirks possible"
  },
  {
    browser: "Safari (macOS)",
    status: "⚠️ Limited",
    notes: "System processing may override"
  },
  {
    browser: "Safari (iOS)",
    status: "⚠️ Degraded",
    notes: "Basic analysis only"
  }
];

export default function BrowserSupport() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Supported Browsers
          </p>
          <h2 className="text-2xl font-semibold text-white md:text-3xl">
            Browser compatibility at a glance.
          </h2>
          <p className="text-sm text-slate-400">
            Use the matrix below to choose the most reliable device for testing.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Browser</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {browserRows.map((row) => (
                <tr key={row.browser} className="bg-slate-950/40">
                  <td className="px-4 py-3 font-medium text-white">{row.browser}</td>
                  <td className="px-4 py-3 text-slate-200">{row.status}</td>
                  <td className="px-4 py-3 text-slate-300">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
