import type { CategoryId } from "./types";

export type GearCategory = "USB dynamic mic" | "USB condenser mic" | "Acoustic treatment" | "Mic positioning";

export interface GearCatalogItem {
  id: string;
  title: string;
  category: GearCategory;
  description: string;
  affiliateUrl?: string;
  supportsIssues: CategoryId[];
}

export const GEAR_CATALOG: readonly GearCatalogItem[] = [
  {
    id: "acoustic-foam-panels",
    title: "Acoustic Foam Panels",
    category: "Acoustic treatment",
    description: "To reduce echo, consider acoustic panels that absorb sound reflections.",
    affiliateUrl: "https://amzn.to/4qTnyHf",
    supportsIssues: ["echo"]
  },
  {
    id: "usb-dynamic-mic",
    title: "FIFINE USB Microphone",
    category: "USB dynamic mic",
    description: "A directional USB mic can help reject background noise and focus on your voice.",
    affiliateUrl: "https://amzn.to/4rpWH5l",
    supportsIssues: ["noise", "echo"]
  },
  {
    id: "usb-condenser-mic",
    title: "USB condenser mic",
    category: "USB condenser mic",
    description: "A condenser mic captures more vocal detail in controlled recording spaces.",
    affiliateUrl: "https://amzn.to/400TGfX",
    supportsIssues: ["level"]
  },
  {
    id: "microphone-arm",
    title: "Microphone Arm",
    category: "Mic positioning",
    description: "A mic arm makes it easy to keep a consistent distance and angle.",
    affiliateUrl: "https://amzn.to/4anIYpX",
    supportsIssues: ["level"]
  }
] as const;

const ISSUE_PRIORITY: Record<CategoryId, readonly string[]> = {
  echo: ["acoustic-foam-panels", "usb-dynamic-mic"],
  noise: ["usb-dynamic-mic"],
  level: ["microphone-arm", "usb-condenser-mic"]
};

export const getGearCatalogItemById = (id: string): GearCatalogItem | null =>
  GEAR_CATALOG.find((item) => item.id === id) ?? null;

export const getPrimaryGearRecommendation = (issue: CategoryId): GearCatalogItem | null => {
  const prioritized = ISSUE_PRIORITY[issue];
  for (const id of prioritized) {
    const item = getGearCatalogItemById(id);
    if (item) {
      return item;
    }
  }

  return GEAR_CATALOG.find((item) => item.supportsIssues.includes(issue)) ?? null;
};

export const getGearRecommendationsForIssue = (issue: CategoryId): GearCatalogItem[] => {
  const primary = getPrimaryGearRecommendation(issue);
  const secondary = GEAR_CATALOG.filter((item) => item.supportsIssues.includes(issue) && item.id !== primary?.id);
  return primary ? [primary, ...secondary] : secondary;
};
