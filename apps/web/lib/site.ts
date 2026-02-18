const DEFAULT_SITE_URL = "https://miccheck.qortxai.com";

function resolveSiteUrl(): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredSiteUrl) {
    return DEFAULT_SITE_URL;
  }

  try {
    return new URL(configuredSiteUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();
export const SITE_URL_OBJECT = new URL(SITE_URL);
export const SITE_NAME = "MicCheck";

export function toAbsoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL_OBJECT).toString();
}
