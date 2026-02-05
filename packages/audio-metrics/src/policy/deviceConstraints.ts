import type { ContextInput } from "../types";
import type { AdviceFailureMode, AdviceMetric } from "./adviceLibrary";
import type { AdviceStepKey } from "./adviceSteps";

interface StepLike {
  key: AdviceStepKey;
}

interface DeviceConstraintContext {
  device_type: ContextInput["device_type"];
  metric?: AdviceMetric;
  failureMode?: AdviceFailureMode;
}

export interface DeviceConstraintResult<TStep extends StepLike> {
  steps: TStep[];
  constraintsApplied: string[];
}

const resolveBluetoothDistanceReplacement = (
  metric: AdviceMetric | undefined,
  failureMode: AdviceFailureMode | undefined
): AdviceStepKey => {
  if (metric === "echo") return "keep_headset_mic_facing_mouth";
  if (metric === "noise" && failureMode === "general_noise") return "keep_head_angle_stable";
  return "keep_headset_mic_facing_mouth";
};

const normalizeDeviceType = (deviceType: ContextInput["device_type"]): "bluetooth" | "built_in" | "unknown" | "other" => {
  if (deviceType === "bluetooth" || deviceType === "headset") return "bluetooth";
  if (["built_in", "desktop", "laptop", "mobile"].includes(deviceType)) return "built_in";
  if (deviceType === "unknown") return "unknown";
  return "other";
};

export const applyDeviceConstraintsWithReplacements = <TStep extends StepLike>(
  steps: TStep[],
  context?: DeviceConstraintContext
): DeviceConstraintResult<TStep> => {
  if (!context) return { steps, constraintsApplied: [] };

  const normalized = normalizeDeviceType(context.device_type);
  const constraintsApplied = new Set<string>();
  const replacedSteps: TStep[] = [];

  for (const step of steps) {
    if (normalized === "bluetooth") {
      if (step.key === "move_mic_closer" || step.key === "increase_distance_from_mic") {
        replacedSteps.push({ ...step, key: resolveBluetoothDistanceReplacement(context.metric, context.failureMode) });
        constraintsApplied.add("replaced_distance_for_bluetooth");
        continue;
      }

      if (step.key === "adjust_input_gain") {
        replacedSteps.push({ ...step, key: "check_system_mic_level" });
        replacedSteps.push({ ...step, key: "check_app_input_level" });
        constraintsApplied.add("replaced_adjust_input_gain_for_bluetooth");
        continue;
      }
    }

    if (normalized === "built_in") {
      if (step.key === "adjust_input_gain") {
        replacedSteps.push({ ...step, key: "check_system_mic_level" });
        replacedSteps.push({ ...step, key: "disable_audio_enhancements" });
        constraintsApplied.add("replaced_adjust_input_gain_for_built_in");
        continue;
      }

      if (step.key === "check_cables_grounding") {
        replacedSteps.push({ ...step, key: "check_charger_interference" });
        replacedSteps.push({ ...step, key: "check_power_interference" });
        constraintsApplied.add("replaced_check_cables_grounding_for_built_in");
        continue;
      }
    }

    if (normalized === "unknown" && step.key === "adjust_input_gain") {
      replacedSteps.push({ ...step, key: "check_system_mic_level" });
      replacedSteps.push({ ...step, key: "check_app_input_level" });
      constraintsApplied.add("replaced_adjust_input_gain_for_unknown");
      continue;
    }

    replacedSteps.push(step);
  }

  const deduped = replacedSteps.filter(
    (step, index, array) => array.findIndex((candidate) => candidate.key === step.key) === index
  );

  return {
    steps: deduped,
    constraintsApplied: [...constraintsApplied]
  };
};

export const applyDeviceConstraints = <TStep extends StepLike>(
  steps: TStep[],
  context?: DeviceConstraintContext
): TStep[] => applyDeviceConstraintsWithReplacements(steps, context).steps;
