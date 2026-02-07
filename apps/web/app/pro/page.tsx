import React from "react";
import TestExperiencePage from "../../components/TestExperiencePage";
import { resolveDiscoverySource, resolveUseCaseFromQueryParam } from "../../lib/useCaseRouting";

interface ProTestPageProps {
  searchParams?: Promise<{
    use_case?: string | string[];
    discovery_source?: string | string[];
    utm_source?: string | string[];
    utm_campaign?: string | string[];
  }>;
}

export default async function ProTestPage({ searchParams }: ProTestPageProps = {}) {
  const resolvedSearchParams = await searchParams;
  const useCaseParam = Array.isArray(resolvedSearchParams?.use_case)
    ? resolvedSearchParams.use_case[0]
    : resolvedSearchParams?.use_case;
  const discoveryRouteParam = Array.isArray(resolvedSearchParams?.discovery_source)
    ? resolvedSearchParams.discovery_source[0]
    : resolvedSearchParams?.discovery_source;
  const utmSourceParam = Array.isArray(resolvedSearchParams?.utm_source)
    ? resolvedSearchParams.utm_source[0]
    : resolvedSearchParams?.utm_source;
  const utmCampaignParam = Array.isArray(resolvedSearchParams?.utm_campaign)
    ? resolvedSearchParams.utm_campaign[0]
    : resolvedSearchParams?.utm_campaign;
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
