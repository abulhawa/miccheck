import React from "react";
import TestExperiencePage from "../../components/TestExperiencePage";
import { resolveDiscoverySource } from "../../lib/useCaseRouting";

interface BasicTestPageProps {
  searchParams?: {
    discovery_source?: string | string[];
    utm_source?: string | string[];
    utm_campaign?: string | string[];
  };
}

export default function BasicTestPage({ searchParams }: BasicTestPageProps) {
  const discoveryRouteParam = Array.isArray(searchParams?.discovery_source)
    ? searchParams.discovery_source[0]
    : searchParams?.discovery_source;
  const utmSourceParam = Array.isArray(searchParams?.utm_source)
    ? searchParams.utm_source[0]
    : searchParams?.utm_source;
  const utmCampaignParam = Array.isArray(searchParams?.utm_campaign)
    ? searchParams.utm_campaign[0]
    : searchParams?.utm_campaign;

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
