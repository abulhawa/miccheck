import { describe, expect, it } from "vitest";
import {
  BASE_USE_CASE_LABEL,
  SECONDARY_USE_CASE_LABEL,
  UI_USE_CASE_LABEL,
  type SecondaryUseCase
} from "./useCaseLabels";
import type { UseCase } from "./types/verdict";

const BASE_KEYS = ["meetings", "podcast", "streaming"] as const satisfies ReadonlyArray<
  Exclude<UseCase, "voice_note">
>;
const UI_KEYS = ["meetings", "podcast", "streaming", "voice_note"] as const satisfies ReadonlyArray<
  UseCase
>;
const SECONDARY_KEYS = ["meetings", "podcast", "streaming", "music"] as const satisfies ReadonlyArray<
  SecondaryUseCase
>;

const sorted = (value: readonly string[]): string[] => [...value].sort();

describe("use case labels", () => {
  it("has exact key coverage for base, ui, and secondary label maps", () => {
    expect(sorted(Object.keys(BASE_USE_CASE_LABEL))).toEqual(sorted(BASE_KEYS));
    expect(sorted(Object.keys(UI_USE_CASE_LABEL))).toEqual(sorted(UI_KEYS));
    expect(sorted(Object.keys(SECONDARY_USE_CASE_LABEL))).toEqual(sorted(SECONDARY_KEYS));
  });
});
