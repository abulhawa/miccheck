import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";

export const metadata: Metadata = {
  title: "Mic Test For Podcast",
  description:
    "You record an episode and your voice sounds off. Run a fast mic test before recording and fix the main issue.",
  alternates: {
    canonical: "/mic-test-for-podcast"
  }
};

export default function MicTestForPodcastLandingPage() {
  return (
    <SeoLandingPage
      description="MicCheck runs a short microphone check in your browser and tells you the first adjustment to make before you hit record."
      headline="Podcast voice not sounding the way you expect?"
      useCase="podcast"
    />
  );
}
