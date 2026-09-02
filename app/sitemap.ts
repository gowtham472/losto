import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Only the two routes that carry public, crawlable content. Everything else
 * is a personal library backed by the visitor's own IndexedDB - there is no
 * server-side content behind those URLs to send a crawler to. See
 * `app/robots.ts` for the matching disallow rules.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/legal`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
