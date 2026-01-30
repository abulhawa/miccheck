export type GradeLetter = "A" | "B" | "C" | "D" | "E" | "F";

export interface MetricsSummary {
  clippingRatio: number;
  rmsDb: number;
  snrDb: number;
  humRatio: number;
  echoScore: number;
}

export interface CategoryScore {
  stars: number;
  label: string;
  description: string;
}

export interface CategoryScores {
  level: CategoryScore;
  noise: CategoryScore;
  room: CategoryScore;
}

export interface Recommendation {
  category: "Clipping" | "Noise" | "Room" | "Volume" | "General";
  message: string;
  confidence: number;
}

export interface AnalysisSummary {
  grade: GradeLetter;
  summary: string;
  categories: CategoryScores;
  metrics: MetricsSummary;
  recommendation: Recommendation;
}
