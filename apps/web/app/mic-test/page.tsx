import React from "react";
import type { Metadata } from "next";
import SeoLandingPage from "../../components/SeoLandingPage";

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
      description="MicCheck runs a short microphone check in your browser and shows the first fix to make your voice easier to hear."
      headline="People keep asking you to repeat yourself?"
      useCase="meetings"
    />
  );
}
