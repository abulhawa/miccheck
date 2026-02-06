import en from "./locales/en.json";
import de from "./locales/de.json";

export type Locale = "en" | "de";

const STORAGE_KEY = "miccheck_locale";
const localeMaps: Record<Locale, Record<string, string>> = { en, de };

const isBrowser = () => typeof window !== "undefined";

export const getLocale = (): Locale => {
  if (isBrowser()) {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && stored in localeMaps) {
      return stored;
    }
    const preferred = window.navigator.language?.toLowerCase() ?? "";
    if (preferred.startsWith("de")) {
      return "de";
    }
  }
  return "en";
};

export const setLocale = (locale: Locale) => {
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
};

const substituteParams = (text: string, params?: Record<string, string>) => {
  if (!params) return text;
  return Object.entries(params).reduce(
    (value, [paramKey, paramValue]) => value.replace(`{${paramKey}}`, paramValue),
    text
  );
};

export const t = (key: string, params?: Record<string, string>, locale?: Locale): string => {
  const resolvedLocale = locale ?? getLocale();
  const selected = localeMaps[resolvedLocale] ?? localeMaps.en;
  const fallback = localeMaps.en;
  const text = selected[key] ?? fallback[key];

  if (!text) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing translation for key "${key}" in "${resolvedLocale}".`);
    }
    return key;
  }

  return substituteParams(text, params);
};
