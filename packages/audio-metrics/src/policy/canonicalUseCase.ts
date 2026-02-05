import type { UseCase } from "../types";

export const canonicalUseCase = (useCase: UseCase): "meetings" | "podcast" | "streaming" => {
  if (useCase === "voice_note") return "podcast";
  return useCase;
};
