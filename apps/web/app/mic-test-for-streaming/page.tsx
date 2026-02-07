import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";

export const metadata: Metadata = {
  title: "Mic Test For Streaming",
  description:
    "Viewers mention your mic sounds bad on stream. Do a quick mic test and fix the biggest issue before going live.",
  alternates: {
    canonical: "/mic-test-for-streaming"
  }
};

export default function MicTestForStreamingLandingPage() {
  return (
    <SeoLandingPage
      description="MicCheck checks your microphone in your browser and gives one practical fix so your stream voice is easier to understand."
      headline="Stream chat says your mic sounds rough?"
      landingRoute="mic-test-for-streaming"
      useCase="streaming"
    />
  );
}
