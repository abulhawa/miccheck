export const HIGH_CONFIDENCE_THRESHOLD = 0.9;
export const MODERATE_CONFIDENCE_THRESHOLD = 0.75;

export const HIGH_CONFIDENCE_LABEL = "High confidence";
export const MODERATE_CONFIDENCE_LABEL = "Moderate confidence";
export const LOW_CONFIDENCE_LABEL = "Low confidence";

export function mapConfidenceToLabel(confidence: number): string {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    return HIGH_CONFIDENCE_LABEL;
  }

  if (confidence >= MODERATE_CONFIDENCE_THRESHOLD) {
    return MODERATE_CONFIDENCE_LABEL;
  }

  return LOW_CONFIDENCE_LABEL;
}
