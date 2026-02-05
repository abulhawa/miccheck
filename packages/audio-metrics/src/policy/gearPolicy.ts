import type { AdviceStep } from "./adviceSteps";

export type GearRelevance = "low" | "medium" | "high";

export interface GearStep extends AdviceStep {
  key: "consider_external_mic";
  relevance: GearRelevance;
  affiliateUrl?: string;
}

const DEFAULT_AFFILIATE_URL = "https://miccheck.example/recommended-mics";

export const buildGearStep = (relevance: GearRelevance): GearStep[] => {
  if (relevance === "low") {
    return [];
  }

  return [
    {
      key: "consider_external_mic",
      relevance,
      affiliateUrl: DEFAULT_AFFILIATE_URL
    }
  ];
};

export const withAffiliatePolicy = (steps: GearStep[], relevance: GearRelevance): GearStep[] => {
  if (relevance !== "low") return steps;
  return steps.map(({ affiliateUrl: _affiliateUrl, ...rest }) => rest);
};
