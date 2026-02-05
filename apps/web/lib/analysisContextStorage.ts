import type { ContextInput, DeviceType, UseCase } from "../types";

const STORAGE_KEY = "miccheck.analysis.context.v1";

const DEFAULT_CONTEXT: ContextInput = {
  use_case: "meetings",
  device_type: "unknown",
  mode: "single"
};

const USE_CASES: UseCase[] = ["meetings", "podcast", "streaming", "voice_note"];
const DEVICE_TYPES: DeviceType[] = [
  "unknown",
  "laptop",
  "desktop",
  "mobile",
  "usb_mic",
  "headset",
  "bluetooth",
  "built_in",
  "other"
];
const MODES: ContextInput["mode"][] = ["single", "basic", "pro"];

const isValidUseCase = (value: string): value is UseCase => USE_CASES.includes(value as UseCase);
const isValidDeviceType = (value: string): value is DeviceType =>
  DEVICE_TYPES.includes(value as DeviceType);
const isValidMode = (value: string): value is ContextInput["mode"] =>
  MODES.includes(value as ContextInput["mode"]);

export const getDefaultAnalysisContext = (): ContextInput => ({ ...DEFAULT_CONTEXT });

export const loadAnalysisContext = (): ContextInput => {
  if (typeof window === "undefined") return getDefaultAnalysisContext();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAnalysisContext();
    const parsed = JSON.parse(raw) as Partial<ContextInput>;

    return {
      use_case: isValidUseCase(parsed.use_case ?? "") ? parsed.use_case : DEFAULT_CONTEXT.use_case,
      device_type: isValidDeviceType(parsed.device_type ?? "")
        ? parsed.device_type
        : DEFAULT_CONTEXT.device_type,
      mode: isValidMode(parsed.mode ?? "") ? parsed.mode : DEFAULT_CONTEXT.mode
    };
  } catch {
    return getDefaultAnalysisContext();
  }
};

export const saveAnalysisContext = (context: ContextInput): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(context));
};

export const ANALYSIS_CONTEXT_OPTIONS = {
  useCases: USE_CASES,
  deviceTypes: DEVICE_TYPES,
  modes: MODES
} as const;
