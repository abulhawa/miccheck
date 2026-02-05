import { describe, expect, it } from "vitest";
import { assertPolicyInvariants } from "./invariants";

describe("policy invariants", () => {
  it("throws when useCaseFit.pass is paired with a C/D/F grade", () => {
    expect(() =>
      assertPolicyInvariants({
        useCaseFit: { fit: "pass" },
        grade: "C",
        reassuranceMode: false,
        bestNextSteps: ["fix.targeted_adjustments"]
      })
    ).toThrow("useCaseFit.fit=pass cannot pair with grade=C");
  });

  it("throws when grade A/A- is paired with warn/fail fit", () => {
    expect(() =>
      assertPolicyInvariants({
        useCaseFit: { fit: "warn" },
        grade: "A",
        reassuranceMode: false,
        bestNextSteps: ["fix.targeted_adjustments"]
      })
    ).toThrow("grade=A cannot pair with useCaseFit.fit=warn");

    expect(() =>
      assertPolicyInvariants({
        useCaseFit: { fit: "fail" },
        grade: "A-",
        reassuranceMode: false,
        bestNextSteps: ["fix.targeted_adjustments"]
      })
    ).toThrow("grade=A- cannot pair with useCaseFit.fit=fail");
  });

  it("throws when reassurance mode has non-empty best next steps", () => {
    expect(() =>
      assertPolicyInvariants({
        useCaseFit: { fit: "pass" },
        grade: "A",
        reassuranceMode: true,
        bestNextSteps: ["fix.keep_setup"]
      })
    ).toThrow("reassuranceMode=true requires bestNextSteps to be empty");
  });

  it("allows consistent state", () => {
    expect(() =>
      assertPolicyInvariants({
        useCaseFit: { fit: "pass" },
        grade: "A",
        reassuranceMode: true,
        bestNextSteps: []
      })
    ).not.toThrow();
  });
});
