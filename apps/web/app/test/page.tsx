import React from "react";
import TestExperiencePage from "../../components/TestExperiencePage";
import { resolveDiscoverySource } from "../../lib/useCaseRouting";

interface BasicTestPageProps {
  searchParams?: Promise<{
    discovery_source?: string | string[];
    utm_source?: string | string[];
    utm_campaign?: string | string[];
  }>;
}

export default async function BasicTestPage({ searchParams }: BasicTestPageProps = {}) {
  const resolvedSearchParams = await searchParams;
  const discoveryRouteParam = Array.isArray(resolvedSearchParams?.discovery_source)
    ? resolvedSearchParams.discovery_source[0]
    : resolvedSearchParams?.discovery_source;
  const utmSourceParam = Array.isArray(resolvedSearchParams?.utm_source)
    ? resolvedSearchParams.utm_source[0]
    : resolvedSearchParams?.utm_source;
  const utmCampaignParam = Array.isArray(resolvedSearchParams?.utm_campaign)
    ? resolvedSearchParams.utm_campaign[0]
    : resolvedSearchParams?.utm_campaign;

  return (
    <TestExperiencePage
      initialDiscoverySource={resolveDiscoverySource({
        landingRoute: discoveryRouteParam,
        utmSource: utmSourceParam,
        utmCampaign: utmCampaignParam,
        fallbackRoute: "test"
      })}
      viewMode="basic"
    />
  );
}
