import type { VerdictCategoryDescriptionKey } from "@miccheck/audio-metrics";
import { t } from "./i18n";

export interface MetricStatus {
  stars: number;
  descriptionKey: VerdictCategoryDescriptionKey;
}

export interface StarRating {
  stars: number;
  label: "Excellent" | "Good" | "Acceptable" | "Needs work" | "Poor";
}

export const toStarRating = (metric: MetricStatus): StarRating => {
  const stars = Math.max(1, Math.min(5, Math.round(metric.stars)));

  if (stars === 5) return { stars, label: t("rating.excellent") as StarRating["label"] };
  if (stars === 4) return { stars, label: t("rating.good") as StarRating["label"] };
  if (stars === 3) return { stars, label: t("rating.acceptable") as StarRating["label"] };
  if (stars === 2) return { stars, label: t("rating.needs_work") as StarRating["label"] };
  return { stars, label: t("rating.poor") as StarRating["label"] };
};
