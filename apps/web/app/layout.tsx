import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MicCheck",
  description: "Analyze your microphone quality locally in the browser."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg font-semibold text-white">
                MC
              </div>
              <div>
                <p className="text-lg font-semibold">MicCheck</p>
                <p className="text-xs text-slate-400">Local microphone analysis</p>
              </div>
            </div>
            <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
              <a className="transition hover:text-white" href="/test">
                Start Test
              </a>
              <a className="transition hover:text-white" href="/results">
                Results Demo
              </a>
            </nav>
          </header>
          <main className="flex-1 py-10">{children}</main>
          <footer className="border-t border-slate-800 pt-6 text-xs text-slate-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>MicCheck runs 100% in your browser. No audio is uploaded.</span>
              <Link className="text-slate-400 transition hover:text-slate-200" href="/docs/PRIVACY.md">
                Privacy policy
              </Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
