import type { UseCase } from "./types/verdict";

export const BASE_USE_CASE_LABEL = {
  meetings: "Meetings",
  podcast: "Podcast",
  streaming: "Streaming"
} satisfies Record<Exclude<UseCase, "voice_note">, string>;

type BaseUseCase = Exclude<UseCase, "voice_note">;

export const UI_USE_CASE_LABEL = {
  ...BASE_USE_CASE_LABEL,
  voice_note: "Voice note"
} satisfies Record<UseCase, string>;

export type SecondaryUseCase = BaseUseCase | "music";

export const SECONDARY_USE_CASE_LABEL = {
  ...BASE_USE_CASE_LABEL,
  music: "Music recording"
} satisfies Record<SecondaryUseCase, string>;
