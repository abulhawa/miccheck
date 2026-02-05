import { UI_USE_CASE_LABEL } from "@miccheck/audio-metrics";
import type { ContextInput, DeviceType, UseCase } from "../types";

const STORAGE_KEY = "miccheck.analysis.context.v1";

const DEFAULT_CONTEXT: ContextInput = {
  use_case: "meetings",
  device_type: "unknown",
  mode: "single"
};

const USE_CASES: UseCase[] = ["meetings", "podcast", "streaming", "voice_note"];
export const formatUseCaseLabel = (useCase: UseCase): string => UI_USE_CASE_LABEL[useCase];

const UI_DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  unknown: "Unknown",
  laptop: "Laptop",
  desktop: "Desktop",
  mobile: "Mobile",
  usb_mic: "USB mic",
  headset: "Headset",
  bluetooth: "Bluetooth",
  built_in: "Built-in",
  other: "Other"
};
export const formatDeviceTypeLabel = (deviceType: DeviceType): string =>
  UI_DEVICE_TYPE_LABEL[deviceType];

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

    const useCase = parsed.use_case;
    const deviceType = parsed.device_type;
    const mode = parsed.mode;

    return {
      use_case: useCase && isValidUseCase(useCase) ? useCase : DEFAULT_CONTEXT.use_case,
      device_type:
        deviceType && isValidDeviceType(deviceType) ? deviceType : DEFAULT_CONTEXT.device_type,
      mode: mode && isValidMode(mode) ? mode : DEFAULT_CONTEXT.mode
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
