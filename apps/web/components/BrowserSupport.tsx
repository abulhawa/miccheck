const browserRows = [
  { name: "Chrome", desktop: "✅", mobile: "✅" },
  { name: "Edge", desktop: "✅", mobile: "✅" },
  { name: "Firefox", desktop: "✅", mobile: "✅" },
  { name: "Safari", desktop: "✅ (14+)", mobile: "✅ (14+)" }
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
            Works across modern desktop and mobile browsers.
          </h2>
          <p className="text-sm text-slate-400">
            MicCheck relies on MediaRecorder and the Web Audio API, so keep your browser
            updated for the best experience.
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Browser</th>
                <th className="px-4 py-3 font-semibold">Desktop</th>
                <th className="px-4 py-3 font-semibold">Mobile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {browserRows.map((browser) => (
                <tr key={browser.name} className="bg-slate-950/40">
                  <td className="px-4 py-3 font-medium text-white">{browser.name}</td>
                  <td className="px-4 py-3 text-slate-200">{browser.desktop}</td>
                  <td className="px-4 py-3 text-slate-200">{browser.mobile}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
