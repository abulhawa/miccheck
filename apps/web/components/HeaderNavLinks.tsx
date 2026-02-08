"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "../lib/i18n";

const isTestingPath = (pathname: string) => pathname === "/test" || pathname === "/pro";

export default function HeaderNavLinks() {
  const pathname = usePathname();
  const onTestingPage = isTestingPath(pathname);

  if (onTestingPage) {
    return (
      <>
        <nav className="hidden gap-6 text-sm text-slate-200 md:flex">
          <Link className="transition hover:text-white" href="/">
            {t("nav.home")}
          </Link>
        </nav>
        <nav className="mt-4 flex gap-4 text-xs text-slate-300 md:hidden">
          <Link
            className="rounded-lg border border-slate-800 px-3 py-2 transition hover:border-slate-700 hover:text-white"
            href="/"
          >
            {t("nav.home")}
          </Link>
        </nav>
      </>
    );
  }

  return (
    <>
      <nav className="hidden gap-6 text-sm text-slate-200 md:flex">
        <Link className="transition hover:text-white" href="/test">
          {t("nav.start_mic_test")}
        </Link>
        <Link className="transition hover:text-white" href="/results">
          {t("nav.sample_results")}
        </Link>
      </nav>
      <nav className="mt-4 flex gap-4 text-xs text-slate-300 md:hidden">
        <Link
          className="rounded-lg border border-slate-800 px-3 py-2 transition hover:border-slate-700 hover:text-white"
          href="/test"
        >
          {t("nav.start_mic_test")}
        </Link>
        <Link
          className="rounded-lg border border-slate-800 px-3 py-2 transition hover:border-slate-700 hover:text-white"
          href="/results"
        >
          {t("nav.sample_results")}
        </Link>
      </nav>
    </>
  );
}
