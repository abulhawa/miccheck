import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";

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
      description="MicCheck gives you a quick browser test and points to the one change that improves meeting call clarity first."
      headline="Zoom calls keep sounding unclear?"
      landingRoute="mic-test-for-zoom"
      useCase="meetings"
    />
  );
}
