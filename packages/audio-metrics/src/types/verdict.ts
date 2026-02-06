export type UseCase = "meetings" | "podcast" | "streaming" | "voice_note";

export type DeviceType =
  | "laptop"
  | "desktop"
  | "mobile"
  | "usb_mic"
  | "headset"
  | "bluetooth"
  | "built_in"
  | "other"
  | "unknown";

export type MetricKey = "level" | "noise" | "echo" | "clipping" | "overall";

export type Severity = "low" | "medium" | "high";

export type PassFail = "pass" | "fail";

export type ContextMode = "single" | "basic" | "pro";

export interface ContextInput {
  mode: ContextMode;
  use_case: UseCase;
  device_type: DeviceType;
}

export type GradeLetter = "A" | "A-" | "B" | "C" | "D" | "F";

export type CategoryId = "level" | "noise" | "echo";

export type CategoryLabelKey =
  | "category.level"
  | "category.noise"
  | "category.echo";

export type CategoryDescriptorKey =
  | "level.clipping_detected"
  | "level.extremely_quiet"
  | "level.extremely_loud"
  | "level.too_quiet"
  | "level.too_loud"
  | "level.noticeably_off_target"
  | "level.slightly_off_target"
  | "level.excellent"
  | "level.low"
  | "level.acceptable_noise_first"
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

export type OverallLabelKey =
  | "overall.label.excellent"
  | "overall.label.good"
  | "overall.label.fair"
  | "overall.label.needs_improvement"
  | "overall.label.unusable";

export type OverallSummaryKey =
  | "overall.summary.excellent"
  | "overall.summary.strong"
  | "overall.summary.fair"
  | "overall.summary.noticeable"
  | "overall.summary.severe"
  | "overall.summary.no_speech";

export type ExplanationCopyKey =
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
  | "overall.echo.impact_minor"
  | "overall.echo.impact_some"
  | "overall.echo.impact_noticeable"
  | CategoryDescriptorKey;

export type FixCopyKey =
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

export type ImpactKey = "impact.level" | "impact.noise" | "impact.echo" | "impact.overall";

export type ImpactSummaryKey =
  | "impact.no_major_issues"
  | "impact.biggest_opportunity"
  | "impact.mainly_affected";

export type NoSpeechTitleKey = "no_speech.title";
export type NoSpeechDescriptionKey = "no_speech.description";

export type VerdictCategoryLabelKey = CategoryLabelKey;
export type VerdictCategoryDescriptionKey = CategoryDescriptorKey;
export type VerdictOverallLabelKey = OverallLabelKey;
export type VerdictOverallSummaryKey = OverallSummaryKey;
export type VerdictExplanationKey = ExplanationCopyKey;
export type VerdictFixKey = FixCopyKey;
export type VerdictImpactKey = ImpactKey;
export type VerdictImpactSummaryKey = ImpactSummaryKey;
export type VerdictNoSpeechTitleKey = NoSpeechTitleKey;
export type VerdictNoSpeechDescriptionKey = NoSpeechDescriptionKey;

export interface VerdictDimension {
  stars: number;
  labelKey: CategoryLabelKey;
  descriptionKey: CategoryDescriptorKey;
}

export interface VerdictDimensions {
  level: VerdictDimension;
  noise: VerdictDimension;
  echo: VerdictDimension;
}

export interface VerdictOverall {
  grade: GradeLetter;
  labelKey: OverallLabelKey;
  summaryKey: OverallSummaryKey;
}

export interface VerdictCopyKeys {
  explanationKey: ExplanationCopyKey;
  fixKey: FixCopyKey;
  impactKey: ImpactKey;
  impactSummaryKey: ImpactSummaryKey;
  noSpeechTitleKey?: NoSpeechTitleKey;
  noSpeechDescriptionKey?: NoSpeechDescriptionKey;
}

export type UseCaseFit = "pass" | "warn" | "fail";
export type DiagnosticCertainty = "low" | "medium" | "high";
export type GearRelevance = "low" | "medium" | "high";
export type AffiliateLinkStatus = "active" | "missing" | "disabled";

export interface VerdictBestNextStep {
  kind: "action" | "gear_optional";
  title: string;
  description?: string;
  gear?: {
    id: string;
    title: string;
    why: string;
    category: string;
    relevance: GearRelevance;
    rationale: string;
    affiliateUrl?: string;
    linkStatus: AffiliateLinkStatus;
  };
}

export type AnalysisSpecialState = "NO_SPEECH" | "TOO_SHORT" | "SILENT" | "ERROR";

export interface Verdict {
  version: "1.0";
  overall: VerdictOverall;
  dimensions: VerdictDimensions;
  primaryIssue: CategoryId | null;
  copyKeys: VerdictCopyKeys;
  context?: ContextInput;
  useCaseFit?: UseCaseFit;
  diagnosticCertainty?: DiagnosticCertainty;
  reassuranceMode?: boolean;
  bestNextSteps?: VerdictBestNextStep[];
  secondaryNotes?: string[];
}
