import { ANALYSIS_CONTEXT_OPTIONS } from "./analysisContextStorage";
import type { UseCase } from "../types";

export const resolveUseCaseFromQueryParam = (value: string | null | undefined): UseCase | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return ANALYSIS_CONTEXT_OPTIONS.useCases.includes(normalized as UseCase)
    ? (normalized as UseCase)
    : null;
};

export const buildUseCaseTestHref = (useCase: UseCase): string =>
  `/pro?use_case=${encodeURIComponent(useCase)}`;
