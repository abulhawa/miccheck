import type { UseCase } from "./types/verdict";

export const BASE_USE_CASE_LABEL = {
  meetings: "Meetings",
  podcast: "Podcast",
  streaming: "Streaming"
} as const;

type BaseUseCase = keyof typeof BASE_USE_CASE_LABEL;

export const UI_USE_CASE_LABEL: Record<UseCase, string> = {
  ...BASE_USE_CASE_LABEL,
  voice_note: "Voice note"
};

export type SecondaryUseCase = BaseUseCase | "music";

export const SECONDARY_USE_CASE_LABEL: Record<SecondaryUseCase, string> = {
  ...BASE_USE_CASE_LABEL,
  music: "Music recording"
};
