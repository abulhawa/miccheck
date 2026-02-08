import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";
import { t } from "../../lib/i18n";

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
      description={t("seo.mic_test_for_podcast.description")}
      headline={t("seo.mic_test_for_podcast.headline")}
      landingRoute="mic-test-for-podcast"
      useCase="podcast"
    />
  );
}
