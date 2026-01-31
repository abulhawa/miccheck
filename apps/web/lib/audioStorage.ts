"use client";

const STORAGE_KEY = "miccheck-last-recording";

const isBrowser = typeof window !== "undefined";
let inMemoryRecording: Blob | null = null;

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, base64Data] = dataUrl.split(",");
  const mimeMatch = meta?.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "audio/webm";
  const binary = atob(base64Data ?? "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
};

/**
 * Persist the most recent recording in sessionStorage so results can reload.
 */
export const saveRecording = async (blob: Blob): Promise<void> => {
  if (!isBrowser) return;
  inMemoryRecording = blob;

  await new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") {
        sessionStorage.setItem(STORAGE_KEY, dataUrl);
        resolve();
      } else {
        reject(new Error("Unable to serialize recording."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read recording."));
    reader.readAsDataURL(blob);
  });
};

/**
 * Retrieve the last recording from sessionStorage (if present).
 */
export const loadRecording = (): Blob | null => {
  if (!isBrowser) return null;
  if (inMemoryRecording) return inMemoryRecording;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const restored = dataUrlToBlob(stored);
    inMemoryRecording = restored;
    return restored;
  } catch {
    return null;
  }
};

/**
 * Clear the persisted recording (used when starting a new test).
 */
export const clearRecording = (): void => {
  if (!isBrowser) return;
  inMemoryRecording = null;
  sessionStorage.removeItem(STORAGE_KEY);
};
