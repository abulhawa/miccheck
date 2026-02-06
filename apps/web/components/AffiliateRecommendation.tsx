"use client";

import React from "react";
import type { CategoryId } from "@miccheck/audio-metrics";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import { t } from "../lib/i18n";

interface AffiliateRecommendationProps {
  issueCategory: CategoryId | null;
}

const affiliateRecommendations: Record<
  CategoryId,
  { name: string; url: string; description: string }
> = {
  echo: {
    name: "Acoustic Foam Panels",
    url: "https://amzn.to/4qTnyHf",
    description: "To reduce echo, consider acoustic panels that absorb sound reflections."
  },
  noise: {
    name: "FIFINE USB Microphone",
    url: "https://amzn.to/4rpWH5l",
    description: "A directional USB mic can help reject background noise and focus on your voice."
  },
  level: {
    name: "Microphone Arm",
    url: "https://amzn.to/4anIYpX",
    description: "A mic arm makes it easy to keep a consistent distance and angle."
  }
};

export default function AffiliateRecommendation({ issueCategory }: AffiliateRecommendationProps) {
  const recommendation = issueCategory ? affiliateRecommendations[issueCategory] : null;
  const affiliatesEnabled = process.env.NEXT_PUBLIC_AFFILIATES_ENABLED === "true";

  if (!recommendation) {
    return null;
  }

  const handleAffiliateClick = () => {
    logEvent(ANALYTICS_EVENTS.affiliateClick, {
      product_name: recommendation.name,
      issue_category: issueCategory ?? "unknown"
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {t("affiliate.recommendation_title")}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-100">{recommendation.name}</h3>
      <p className="mt-2 text-xs text-slate-400">{recommendation.description}</p>
      {affiliatesEnabled ? (
        <>
          <a
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 underline"
            href={recommendation.url}
            onClick={handleAffiliateClick}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            {t("affiliate.view_recommended_gear")}
          </a>
          <p className="mt-2 text-xs text-slate-500">{t("affiliate.disclosure_short")}</p>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">{t("affiliate.empty_state")}</p>
      )}
    </div>
  );
}
