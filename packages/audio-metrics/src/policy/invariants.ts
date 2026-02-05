import type { GradeLetter } from "../types";
import type { MetricResult } from "./evaluateMetrics";

export interface PolicyInvariantState {
  useCaseFit: {
    fit: MetricResult;
  };
  grade: GradeLetter;
  reassuranceMode: boolean;
  bestNextSteps: string[];
}

export const assertPolicyInvariants = ({
  useCaseFit,
  grade,
  reassuranceMode,
  bestNextSteps
}: PolicyInvariantState): void => {
  if (useCaseFit.fit === "pass" && ["C", "D", "F"].includes(grade)) {
    throw new Error(
      `Policy invariant violated: useCaseFit.fit=pass cannot pair with grade=${grade}.`
    );
  }

  if (["A", "A-"].includes(grade) && ["warn", "fail"].includes(useCaseFit.fit)) {
    throw new Error(
      `Policy invariant violated: grade=${grade} cannot pair with useCaseFit.fit=${useCaseFit.fit}.`
    );
  }

  if (reassuranceMode && bestNextSteps.length > 0) {
    throw new Error(
      "Policy invariant violated: reassuranceMode=true requires bestNextSteps to be empty."
    );
  }

  if (useCaseFit.fit === "pass" && !reassuranceMode) {
    throw new Error(
      "Policy invariant violated: useCaseFit.fit=pass requires reassuranceMode=true."
    );
  }

  if (useCaseFit.fit === "pass" && bestNextSteps.length > 0) {
    throw new Error(
      "Policy invariant violated: useCaseFit.fit=pass requires bestNextSteps to be empty."
    );
  }
};
