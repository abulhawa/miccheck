"use client";

import React from "react";
import type { CategoryId } from "@miccheck/audio-metrics";
import { getPrimaryGearRecommendation } from "@miccheck/audio-metrics/src/gearCatalog";
import { ANALYTICS_EVENTS, logEvent } from "../lib/analytics";
import { t } from "../lib/i18n";

interface AffiliateRecommendationProps {
  issueCategory: CategoryId | null;
}

export default function AffiliateRecommendation({ issueCategory }: AffiliateRecommendationProps) {
  const recommendation = issueCategory ? getPrimaryGearRecommendation(issueCategory) : null;
  const affiliatesEnabled = process.env.NEXT_PUBLIC_AFFILIATES_ENABLED === "true";

  if (!recommendation) {
    return null;
  }

  const handleAffiliateClick = () => {
    logEvent(ANALYTICS_EVENTS.affiliateClick, {
      product_name: recommendation.title,
      issue_category: issueCategory ?? "unknown"
    });
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {t("affiliate.recommendation_title")}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-slate-100">{recommendation.title}</h3>
      <p className="mt-2 text-xs text-slate-400">{recommendation.description}</p>
      {affiliatesEnabled && recommendation.affiliateUrl ? (
        <>
          <a
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-300 underline"
            href={recommendation.affiliateUrl}
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
