import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";

export const metadata: Metadata = {
  title: "Mic Test For Music Recording",
  description:
    "You finish a take and your voice sounds wrong. Run a quick mic test before recording and fix the main issue first.",
  alternates: {
    canonical: "/mic-test-for-music-recording"
  }
};

export default function MicTestForMusicRecordingLandingPage() {
  return (
    <SeoLandingPage
      description="MicCheck runs a short microphone check in your browser and gives one practical fix before your next recording."
      headline="Your recording takes sound off?"
      useCase="podcast"
    />
  );
}
