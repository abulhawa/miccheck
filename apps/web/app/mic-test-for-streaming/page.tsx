import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";
import { t } from "../../lib/i18n";

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
      description={t("seo.mic_test_for_streaming.description")}
      headline={t("seo.mic_test_for_streaming.headline")}
      landingRoute="mic-test-for-streaming"
      useCase="streaming"
    />
  );
}
