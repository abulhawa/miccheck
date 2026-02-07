import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://miccheck-sage.vercel.app"),
  title: {
    default: "MicCheck - 7-Second Mic Quality Test",
    template: "%s | MicCheck"
  },
  description: "Find out why your audio sounds bad. Free, private, no sign-up.",
  other: {
    "google-site-verification": "zsJsIA8UAymquGY2wdM8XB-hDCCLb3F-gfcJ4L6fF3g",
  },
  keywords: ["microphone test", "audio quality", "mic check", "audio test", "podcast audio"],
  authors: [{ name: "Ali Abul Hawa" }],
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎤</text></svg>`,
  },
  openGraph: {
    title: "MicCheck - 7-Second Mic Quality Test",
    description: "Find out why your audio sounds bad. Free, private, no sign-up.",
    url: "https://miccheck-sage.vercel.app/",
    siteName: "MicCheck",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MicCheck - 7-Second Mic Quality Test"
      }
    ],
    locale: 'en_US',
    type: "website",
  },
  facebook: {
    appId: '2153727485390703',
  },
  twitter: {
    card: "summary_large_image",
    title: "MicCheck - 7-Second Mic Quality Test",
    description: "Find out why your audio sounds bad. Free, private, no sign-up.",
    images: ["/og-image.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-8">
          <header className="flex items-center justify-between">
            <Link
              aria-label="Go to MicCheck home page"
              className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              href="/"
            >
              <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
                MC
              </div>
              <div>
                <p className="text-lg font-semibold">MicCheck</p>
                <p className="text-xs text-slate-400">7-Second Mic Quality Test</p>
              </div>
            </Link>
          </header>
          <main className="flex-1 py-6 sm:py-10">{children}</main>
          <Footer />
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
