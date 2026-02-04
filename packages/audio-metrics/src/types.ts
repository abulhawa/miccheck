export type GradeLetter = "A" | "B" | "C" | "D" | "E" | "F";

export interface MetricsSummary {
  clippingRatio: number;
  rmsDb: number;
  speechRmsDb: number;
  snrDb: number;
  humRatio: number;
  echoScore: number;
}

export type CategoryId = "level" | "noise" | "echo";

export type VerdictCategoryLabelKey =
  | "category.level"
  | "category.noise"
  | "category.echo";

export type VerdictCategoryDescriptionKey =
  | "level.clipping_detected"
  | "level.extremely_quiet"
  | "level.extremely_loud"
  | "level.too_quiet"
  | "level.too_loud"
  | "level.noticeably_off_target"
  | "level.slightly_off_target"
  | "level.excellent"
  | "noise.very_clean"
  | "noise.clean_background"
  | "noise.some_background_noise"
  | "noise.noisy_background"
  | "noise.very_noisy"
  | "noise.electrical_hum"
  | "echo.overwhelming"
  | "echo.strong"
  | "echo.some_room_echo"
  | "echo.slight_reflections"
  | "echo.minimal"
  | "special.no_speech";

export type VerdictOverallLabelKey =
  | "overall.label.excellent"
  | "overall.label.good"
  | "overall.label.fair"
  | "overall.label.needs_improvement"
  | "overall.label.unusable";

export type VerdictOverallSummaryKey =
  | "overall.summary.excellent"
  | "overall.summary.strong"
  | "overall.summary.fair"
  | "overall.summary.noticeable"
  | "overall.summary.severe"
  | "overall.summary.no_speech";

export type VerdictExplanationKey =
  | "explanation.clipping_distortion"
  | "explanation.extremely_quiet"
  | "explanation.extremely_loud"
  | "explanation.too_quiet"
  | "explanation.too_loud"
  | "explanation.noticeably_off_target"
  | "explanation.some_background_noise"
  | "explanation.noisy_background"
  | "explanation.very_noisy"
  | "explanation.electrical_hum"
  | "explanation.overwhelming_echo"
  | "explanation.strong_echo"
  | "explanation.some_room_echo"
  | "explanation.no_speech"
  | VerdictCategoryDescriptionKey;

export type VerdictFixKey =
  | "fix.lower_gain_move_back"
  | "fix.increase_gain_move_closer"
  | "fix.lower_gain_move_back_slight"
  | "fix.nudge_gain"
  | "fix.reduce_noise_quieter_space"
  | "fix.reduce_noise_directional_mic"
  | "fix.silence_room_close_mic"
  | "fix.check_cables_grounding"
  | "fix.add_acoustic_treatment_move_closer"
  | "fix.add_soft_furnishings_move_closer"
  | "fix.light_acoustic_treatment_close_mic"
  | "fix.keep_setup"
  | "fix.targeted_adjustments"
  | "fix.no_speech";

export type VerdictImpactKey =
  | "impact.level"
  | "impact.noise"
  | "impact.echo"
  | "impact.overall";

export type VerdictImpactSummaryKey =
  | "impact.no_major_issues"
  | "impact.biggest_opportunity"
  | "impact.mainly_affected";

export type VerdictNoSpeechTitleKey = "no_speech.title";
export type VerdictNoSpeechDescriptionKey = "no_speech.description";

export interface VerdictDimension {
  stars: number;
  labelKey: VerdictCategoryLabelKey;
  descriptionKey: VerdictCategoryDescriptionKey;
}

export interface VerdictDimensions {
  level: VerdictDimension;
  noise: VerdictDimension;
  echo: VerdictDimension;
}

export interface VerdictOverall {
  grade: GradeLetter;
  labelKey: VerdictOverallLabelKey;
  summaryKey: VerdictOverallSummaryKey;
}

export interface VerdictCopyKeys {
  explanationKey: VerdictExplanationKey;
  fixKey: VerdictFixKey;
  impactKey: VerdictImpactKey;
  impactSummaryKey: VerdictImpactSummaryKey;
  noSpeechTitleKey?: VerdictNoSpeechTitleKey;
  noSpeechDescriptionKey?: VerdictNoSpeechDescriptionKey;
}

export interface Verdict {
  overall: VerdictOverall;
  dimensions: VerdictDimensions;
  primaryIssue: CategoryId | null;
  copyKeys: VerdictCopyKeys;
}

export interface Recommendation {
  category: "Clipping" | "Noise" | "Echo" | "Volume" | "General";
  message: string;
  confidence: number;
}

export type SpecialState = "NO_SPEECH";

export interface AnalysisSummary {
  verdict: Verdict;
  metrics: MetricsSummary;
  recommendation: Recommendation;
  specialState?: SpecialState;
}
