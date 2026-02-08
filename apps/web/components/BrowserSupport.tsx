import { t } from "../lib/i18n";

export default function BrowserSupport() {
  const browserRows = [
    {
      browser: "Chrome / Edge (desktop)",
      status: t("browser_support.status.full"),
      notes: t("browser_support.notes.best_experience")
    },
    {
      browser: "Firefox (desktop)",
      status: t("browser_support.status.partial"),
      notes: t("browser_support.notes.minor_quirks")
    },
    {
      browser: "Safari (macOS)",
      status: t("browser_support.status.limited"),
      notes: t("browser_support.notes.system_processing")
    },
    {
      browser: "Safari (iOS)",
      status: t("browser_support.status.degraded"),
      notes: t("browser_support.notes.basic_analysis")
    }
  ];

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            {t("browser_support.eyebrow")}
          </p>
          <h2 className="text-2xl font-semibold text-white md:text-3xl">
            {t("browser_support.title")}
          </h2>
          <p className="text-sm text-slate-400">
            {t("browser_support.subtitle")}
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/80 text-xs uppercase tracking-[0.2em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("browser_support.table.browser")}</th>
                <th className="px-4 py-3 font-semibold">{t("browser_support.table.status")}</th>
                <th className="px-4 py-3 font-semibold">{t("browser_support.table.notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {browserRows.map((row) => (
                <tr key={row.browser} className="bg-slate-950/40">
                  <td className="px-4 py-3 font-medium text-white">{row.browser}</td>
                  <td className="px-4 py-3 text-slate-200">{row.status}</td>
                  <td className="px-4 py-3 text-slate-200">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
