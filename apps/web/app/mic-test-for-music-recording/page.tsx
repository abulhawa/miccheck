import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";
import { t } from "../../lib/i18n";

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
      description={t("seo.mic_test_for_music_recording.description")}
      headline={t("seo.mic_test_for_music_recording.headline")}
      landingRoute="mic-test-for-music-recording"
      useCase="podcast"
    />
  );
}
