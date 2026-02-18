import type { MetadataRoute } from "next";
import { toAbsoluteUrl } from "../lib/site";

const INDEXED_ROUTES = [
  "/",
  "/mic-test",
  "/mic-test-for-zoom",
  "/mic-test-for-podcast",
  "/mic-test-for-streaming",
  "/mic-test-for-music-recording",
  "/test",
  "/pro",
  "/results",
  "/privacy"
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return INDEXED_ROUTES.map((route) => ({
    url: toAbsoluteUrl(route),
    lastModified
  }));
}
