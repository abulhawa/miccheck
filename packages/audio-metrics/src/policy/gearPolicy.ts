import type { AdviceStep } from "./adviceSteps";
import type { AffiliateLinkStatus } from "../types";

export type GearRelevance = "low" | "medium" | "high";

export interface GearStep extends AdviceStep {
  key: "consider_external_mic";
  relevance: GearRelevance;
  category: "USB dynamic mic" | "USB condenser mic";
  rationale: string;
  affiliateUrl?: string;
  id: string;
  title: string;
  why: string;
  linkStatus: AffiliateLinkStatus;
}

const DEFAULT_AFFILIATE_URLS: Record<GearStep["category"], string | undefined> = {
  "USB dynamic mic": "https://amzn.to/4qTnyHf",
  "USB condenser mic": "https://amzn.to/4qTnyHf"
};

const gearIdFor = (category: GearStep["category"]): string =>
  category === "USB dynamic mic" ? "usb-dynamic-mic" : "usb-condenser-mic";

const gearTitleFor = (category: GearStep["category"]): string => category;

const linkStatusFor = (affiliateUrl?: string): AffiliateLinkStatus =>
  affiliateUrl ? "active" : "missing";

export const buildGearStep = (
  relevance: GearRelevance,
  category: GearStep["category"],
  rationale: string
): GearStep[] => {
  if (relevance === "low") {
    return [];
  }

  return [
    {
      kind: "gear_optional",
      key: "consider_external_mic",
      relevance,
      category,
      rationale,
      affiliateUrl: DEFAULT_AFFILIATE_URLS[category],
      id: gearIdFor(category),
      title: gearTitleFor(category),
      why: rationale,
      linkStatus: linkStatusFor(DEFAULT_AFFILIATE_URLS[category])
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
