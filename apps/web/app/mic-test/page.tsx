import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";
import { t } from "../../lib/i18n";

export const metadata: Metadata = {
  title: "Mic Test",
  description:
    "People ask you to repeat yourself in calls. Run a quick mic test and get one clear next step.",
  alternates: {
    canonical: "/mic-test"
  }
};

export default function MicTestLandingPage() {
  return (
    <SeoLandingPage
      description={t("seo.mic_test.description")}
      headline={t("seo.mic_test.headline")}
      landingRoute="mic-test"
      useCase="meetings"
    />
  );
}
