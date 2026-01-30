export interface CategoryScore {
  stars: number;
  label: string;
  description: string;
}

export interface Recommendation {
  category: "Clipping" | "Noise" | "Room" | "Volume" | "General";
  message: string;
  confidence: number;
}

export interface AnalysisMetrics {
  clippingRatio: number;
  rmsDb: number;
  snrDb: number;
  humRatio: number;
  echoScore: number;
}

export interface AnalysisResult {
  grade: "A" | "B" | "C" | "D" | "E" | "F";
  summary: string;
  categories: {
    level: CategoryScore;
    noise: CategoryScore;
    room: CategoryScore;
  };
  metrics: AnalysisMetrics;
  recommendation: Recommendation;
}
