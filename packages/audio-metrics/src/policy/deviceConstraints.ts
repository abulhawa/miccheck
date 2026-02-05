import type { ContextInput } from "../types";
import type { AdviceStep } from "./adviceSteps";

const DISTANCE_STEP_KEYS = new Set(["move_mic_closer", "increase_distance_from_mic"]);
const GAIN_STEP_KEYS = new Set(["adjust_input_gain"]);

export const applyDeviceConstraints = (
  steps: AdviceStep[],
  context?: Pick<ContextInput, "device_type">
): AdviceStep[] => {
  if (!context) return steps;

  return steps.filter((step) => {
    if (context.device_type === "bluetooth" && DISTANCE_STEP_KEYS.has(step.key)) {
      return false;
    }

    if (context.device_type === "built_in" && GAIN_STEP_KEYS.has(step.key)) {
      return false;
    }

    return true;
  });
};
