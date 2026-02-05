import type { VerdictCategoryDescriptionKey } from "@miccheck/audio-metrics";

export interface MetricStatus {
  stars: number;
  descriptionKey: VerdictCategoryDescriptionKey;
}

export interface StarRating {
  stars: number;
  label: "Excellent" | "Good" | "Fair" | "Needs work" | "Poor";
}

export const toStarRating = (metric: MetricStatus): StarRating => {
  const stars = Math.max(1, Math.min(5, Math.round(metric.stars)));

  if (stars === 5) return { stars, label: "Excellent" };
  if (stars === 4) return { stars, label: "Good" };
  if (stars === 3) return { stars, label: "Fair" };
  if (stars === 2) return { stars, label: "Needs work" };
  return { stars, label: "Poor" };
};
