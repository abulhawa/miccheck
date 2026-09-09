import en from "./locales/en.json";
import de from "./locales/de.json";

export type Locale = "en" | "de";

const localeMaps: Record<Locale, Record<string, string>> = { en, de };

// The public UI has one explicit locale until locale routes are introduced.
// Never read browser preferences during render: SSR must match hydration.
export const getLocale = (): Locale => "en";

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
      console.warn(`[i18n] Missing translation for key "${key}" in "${resolvedLocale}".`);
    }
    return key;
  }

  return substituteParams(text, params);
};
