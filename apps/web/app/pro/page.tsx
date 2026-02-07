import React from "react";
import TestExperiencePage from "../../components/TestExperiencePage";
import { resolveDiscoverySource, resolveUseCaseFromQueryParam } from "../../lib/useCaseRouting";

interface ProTestPageProps {
  searchParams?: {
    use_case?: string | string[];
    discovery_source?: string | string[];
    utm_source?: string | string[];
    utm_campaign?: string | string[];
  };
}

export default function ProTestPage({ searchParams }: ProTestPageProps) {
  const useCaseParam = Array.isArray(searchParams?.use_case)
    ? searchParams.use_case[0]
    : searchParams?.use_case;
  const discoveryRouteParam = Array.isArray(searchParams?.discovery_source)
    ? searchParams.discovery_source[0]
    : searchParams?.discovery_source;
  const utmSourceParam = Array.isArray(searchParams?.utm_source)
    ? searchParams.utm_source[0]
    : searchParams?.utm_source;
  const utmCampaignParam = Array.isArray(searchParams?.utm_campaign)
    ? searchParams.utm_campaign[0]
    : searchParams?.utm_campaign;
  const initialUseCase = resolveUseCaseFromQueryParam(useCaseParam);
  const initialDiscoverySource = resolveDiscoverySource({
    landingRoute: discoveryRouteParam,
    utmSource: utmSourceParam,
    utmCampaign: utmCampaignParam,
    fallbackRoute: "pro"
  });

  return (
    <TestExperiencePage
      initialDiscoverySource={initialDiscoverySource}
      initialUseCase={initialUseCase ?? undefined}
      viewMode="pro"
    />
  );
}
