import type { MetricsSummary } from "../types";

export const getContextualExplanation = (metrics: MetricsSummary): string[] => {
  const tips: string[] = [];

  if (metrics.rmsDb < -24) {
    tips.push("Your recording is quiet. Getting 6dB closer doubles loudness!");
  }

  if (metrics.snrDb < 30) {
    tips.push(`Your SNR is ${metrics.snrDb.toFixed(1)}dB. For clear calls, aim for 35+ dB.`);
  }

  tips.push("Professional podcasts: >45 dB SNR, -18 dBFS level");
  tips.push("Good video calls: >30 dB SNR, -24 to -12 dBFS level");

  return tips;
};
