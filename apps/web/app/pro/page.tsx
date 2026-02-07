import React from "react";
import TestExperiencePage from "../../components/TestExperiencePage";
import { resolveUseCaseFromQueryParam } from "../../lib/useCaseRouting";

interface ProTestPageProps {
  searchParams?: {
    use_case?: string | string[];
  };
}

export default function ProTestPage({ searchParams }: ProTestPageProps) {
  const useCaseParam = Array.isArray(searchParams?.use_case)
    ? searchParams.use_case[0]
    : searchParams?.use_case;
  const initialUseCase = resolveUseCaseFromQueryParam(useCaseParam);

  return <TestExperiencePage initialUseCase={initialUseCase ?? undefined} viewMode="pro" />;
}
