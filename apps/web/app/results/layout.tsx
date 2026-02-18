import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sample Results",
  description: "View a sample MicCheck report with scoring and actionable next steps.",
  alternates: {
    canonical: "/results"
  }
};

interface ResultsLayoutProps {
  children: ReactNode;
}

export default function ResultsLayout({ children }: ResultsLayoutProps) {
  return children;
}
