import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "MicCheck - Speedtest for Microphones",
  description: "Test your microphone quality in 7 seconds. Free, private, no sign-up.",
  openGraph: {
    title: "MicCheck - Speedtest for Microphones",
    description: "Test your microphone quality in 7 seconds. Free, private, no sign-up.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MicCheck microphone test preview"
      }
    ]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎤</text></svg>"
        />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
                MC
              </div>
              <div>
                <p className="text-lg font-semibold">MicCheck</p>
                <p className="text-xs text-slate-400">Local microphone analysis</p>
              </div>
            </div>
            <nav className="hidden gap-6 text-sm text-slate-200 md:flex">
              <a className="transition hover:text-white" href="/test">
                Start Test
              </a>
              <a className="transition hover:text-white" href="/results">
                Results Demo
              </a>
            </nav>
          </header>
          <main className="flex-1 py-10">{children}</main>
          <Footer />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
