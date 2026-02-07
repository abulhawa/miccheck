import { ANALYSIS_CONTEXT_OPTIONS } from "./analysisContextStorage";
import type { UseCase } from "../types";

export const resolveUseCaseFromQueryParam = (value: string | null | undefined): UseCase | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return ANALYSIS_CONTEXT_OPTIONS.useCases.includes(normalized as UseCase)
    ? (normalized as UseCase)
    : null;
};

const sanitizeDiscoveryValue = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const safe = trimmed.replace(/[^a-z0-9_-]/g, "");
  return safe.length > 0 ? safe.slice(0, 64) : null;
};

export const resolveDiscoverySource = (input: {
  landingRoute?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  fallbackRoute?: "pro" | "test";
}): string => {
  const utmSource = sanitizeDiscoveryValue(input.utmSource);
  const utmCampaign = sanitizeDiscoveryValue(input.utmCampaign);
  const landingRoute = sanitizeDiscoveryValue(input.landingRoute);

  if (utmSource && utmCampaign) {
    return `utm:${utmSource}:${utmCampaign}`;
  }
  if (utmSource) {
    return `utm_source:${utmSource}`;
  }
  if (utmCampaign) {
    return `utm_campaign:${utmCampaign}`;
  }
  if (landingRoute) {
    return `landing:${landingRoute}`;
  }
  return `route:${input.fallbackRoute ?? "pro"}`;
};

export const buildUseCaseTestHref = (useCase: UseCase, discoveryRoute?: string): string => {
  const params = new URLSearchParams({ use_case: useCase });
  if (discoveryRoute) {
    params.set("discovery_source", discoveryRoute);
  }
  return `/pro?${params.toString()}`;
};
