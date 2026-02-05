import type { DeviceType, MetricKey, UseCase, UseCaseFit } from "../types";
import { canonicalUseCase } from "./canonicalUseCase";
import type { MetricStatus } from "./evaluateMetrics";

const USE_CASE_ORDER = ["meetings", "streaming", "podcast", "music"] as const;
type SecondaryUseCase = (typeof USE_CASE_ORDER)[number];
type FitResult = UseCaseFit;

type MetricsMap = Record<MetricKey, MetricStatus>;

interface SecondaryNotesContext {
  useCase: UseCase;
  deviceType: DeviceType;
}

interface SecondaryNotesInput {
  metricStatuses: MetricsMap;
  context: SecondaryNotesContext;
  primaryUseCaseFit: FitResult;
  evaluateUseCaseFit: (useCase: SecondaryUseCase) => MetricsMap;
}

const USE_CASE_LABEL: Record<SecondaryUseCase, string> = {
  meetings: "Meetings",
  streaming: "Streaming",
  podcast: "Podcasts",
  music: "Music recording"
};

const fitRank = (fit: FitResult): number => (fit === "pass" ? 2 : fit === "warn" ? 1 : 0);

const toCanonicalUseCase = (useCase: UseCase): SecondaryUseCase => canonicalUseCase(useCase);

const primaryIssueFromStatuses = (statuses: MetricsMap): MetricKey => {
  const ordered: MetricKey[] = ["clipping", "echo", "noise", "level"];
  const failed = ordered.find((metric) => statuses[metric].result === "fail");
  if (failed) return failed;

  const warned = ordered.find((metric) => statuses[metric].result === "warn");
  if (warned) return warned;

  return "overall";
};

const reasonSnippetFromIssue = (issue: MetricKey): string => {
  if (issue === "level") return "level is a bit low/high";
  if (issue === "noise") return "background noise is noticeable";
  if (issue === "echo") return "room echo is strong";
  if (issue === "clipping") return "audio is clipping";
  return "audio quality is inconsistent";
};

const pickPositiveUseCase = (
  primaryFit: FitResult,
  candidates: Array<{ useCase: SecondaryUseCase; fit: FitResult }>
): SecondaryUseCase | null => {
  if (primaryFit === "pass") {
    return candidates.find(({ fit }) => fit === "pass")?.useCase ?? null;
  }

  if (primaryFit === "warn") {
    return candidates.find(({ useCase, fit }) => useCase === "meetings" && fit === "pass")?.useCase ?? null;
  }

  const easier = candidates.filter(({ useCase }) => useCase === "meetings" || useCase === "streaming");
  return easier.find(({ fit }) => fit === "pass" || fit === "warn")?.useCase ?? null;
};

const pickCautionUseCase = (
  primaryFit: FitResult,
  candidates: Array<{ useCase: SecondaryUseCase; fit: FitResult }>
): SecondaryUseCase | null => {
  const harder = candidates.filter(({ useCase }) => useCase === "podcast" || useCase === "music");

  if (primaryFit === "pass") {
    return harder.find(({ fit }) => fit === "fail")?.useCase ?? harder.find(({ fit }) => fit === "warn")?.useCase ?? null;
  }

  if (primaryFit === "warn") {
    return harder.find(({ fit }) => fit === "fail")?.useCase ?? null;
  }

  return null;
};

export const buildSecondaryNotes = ({
  metricStatuses,
  context,
  primaryUseCaseFit,
  evaluateUseCaseFit
}: SecondaryNotesInput): string[] => {
  void context.deviceType;
  const selectedUseCase = toCanonicalUseCase(context.useCase);

  const alternatives = USE_CASE_ORDER
    .filter((useCase) => useCase !== selectedUseCase)
    .map((useCase) => {
      const statuses = evaluateUseCaseFit(useCase);
      return {
        useCase,
        fit: statuses.overall.result as FitResult,
        statuses
      };
    })
    .sort((left, right) => fitRank(right.fit) - fitRank(left.fit) || left.useCase.localeCompare(right.useCase));

  const notes: string[] = [];

  const positiveUseCase = pickPositiveUseCase(
    primaryUseCaseFit,
    alternatives.map(({ useCase, fit }) => ({ useCase, fit }))
  );

  if (positiveUseCase) {
    if (primaryUseCaseFit === "pass") {
      notes.push(`Also good for ${USE_CASE_LABEL[positiveUseCase]}.`);
    } else if (primaryUseCaseFit === "warn") {
      notes.push(`Likely acceptable for ${USE_CASE_LABEL[positiveUseCase]}.`);
    } else {
      notes.push(`It may still work for ${USE_CASE_LABEL[positiveUseCase]} with minor tweaks.`);
    }
  }

  const cautionUseCase = pickCautionUseCase(
    primaryUseCaseFit,
    alternatives.map(({ useCase, fit }) => ({ useCase, fit }))
  );

  if (cautionUseCase && notes.length < 2) {
    const cautionStatuses = alternatives.find(({ useCase }) => useCase === cautionUseCase)?.statuses;
    const issue = primaryIssueFromStatuses(metricStatuses);
    const fallbackIssue = cautionStatuses ? primaryIssueFromStatuses(cautionStatuses) : "overall";
    const reason = reasonSnippetFromIssue(issue === "overall" ? fallbackIssue : issue);

    if (primaryUseCaseFit === "pass") {
      notes.push(`Not ideal for ${USE_CASE_LABEL[cautionUseCase]} — ${reason}.`);
    } else {
      notes.push(`Too limited for ${USE_CASE_LABEL[cautionUseCase]} — ${reason}.`);
    }
  }

  return notes.slice(0, 2);
};
