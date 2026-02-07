import type { AdviceStep } from "./adviceSteps";
import type { AffiliateLinkStatus, CategoryId } from "../types";
import { getPrimaryGearRecommendation, type GearCategory } from "../gearCatalog";

export type GearRelevance = "low" | "medium" | "high";

export interface GearStep extends AdviceStep {
  key: "consider_external_mic";
  relevance: GearRelevance;
  category: GearCategory;
  rationale: string;
  affiliateUrl?: string;
  id: string;
  title: string;
  why: string;
  supportsIssues: CategoryId[];
  linkStatus: AffiliateLinkStatus;
}

const linkStatusFor = (affiliateUrl?: string): AffiliateLinkStatus =>
  affiliateUrl ? "active" : "missing";

export const buildGearStep = (
  relevance: GearRelevance,
  issue: CategoryId,
  rationale: string
): GearStep[] => {
  if (relevance === "low") {
    return [];
  }
  const recommendation = getPrimaryGearRecommendation(issue);
  if (!recommendation) {
    return [];
  }

  return [
    {
      kind: "gear_optional",
      key: "consider_external_mic",
      relevance,
      category: recommendation.category,
      rationale,
      affiliateUrl: recommendation.affiliateUrl,
      id: recommendation.id,
      title: recommendation.title,
      why: rationale,
      supportsIssues: [...recommendation.supportsIssues],
      linkStatus: linkStatusFor(recommendation.affiliateUrl)
    }
  ];
};

export const withAffiliatePolicy = (steps: GearStep[], relevance: GearRelevance): GearStep[] => {
  if (relevance !== "low") return steps;
  return steps.map(({ affiliateUrl: _affiliateUrl, ...rest }) => ({
    ...rest,
    linkStatus: "disabled"
  }));
};
