import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";
import { t } from "../../lib/i18n";

export const metadata: Metadata = {
  title: "Mic Test For Zoom",
  description:
    "Your voice cuts out or sounds weak in Zoom meetings. Check your mic quickly and see what to change first.",
  alternates: {
    canonical: "/mic-test-for-zoom"
  }
};

export default function MicTestForZoomLandingPage() {
  return (
    <SeoLandingPage
      description={t("seo.mic_test_for_zoom.description")}
      headline={t("seo.mic_test_for_zoom.headline")}
      landingRoute="mic-test-for-zoom"
      useCase="meetings"
    />
  );
}
