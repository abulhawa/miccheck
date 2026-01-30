export type GradeLetter = "A" | "B" | "C" | "D" | "E" | "F";

export interface MetricsSummary {
  clippingRatio: number;
  rmsDb: number;
  snrDb: number;
  humRatio: number;
  echoScore: number;
}

export type CategoryLabel = "Level" | "Noise" | "Echo";

export interface CategoryScore {
  stars: number;
  label: CategoryLabel;
  description: string;
}

export interface CategoryScores {
  level: CategoryScore;
  noise: CategoryScore;
  echo: CategoryScore;
}

export interface Recommendation {
  category: "Clipping" | "Noise" | "Echo" | "Volume" | "General";
  message: string;
  confidence: number;
}

export type SpecialState = "NO_SPEECH";

export type FixPriority = "critical" | "high" | "medium" | "low";

export interface PrimaryFix {
  title: string;
  description: string;
  priority: FixPriority;
}

export interface AnalysisSummary {
  grade: GradeLetter;
  summary: string;
  categories: CategoryScores;
  metrics: MetricsSummary;
  primaryIssueCategory: CategoryLabel;
  explanation: string;
  recommendation: Recommendation;
  primaryFix?: PrimaryFix;
  specialState?: SpecialState;
}
