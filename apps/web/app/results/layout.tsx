import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Interactive Audio Demo",
  description: "Run local AI on matching synthetic audio examples without microphone permission.",
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
