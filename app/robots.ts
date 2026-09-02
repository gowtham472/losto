import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Losto is a personal offline reading app. Its pages hold no public content -
 * every library lives in the reader's own browser - so there is nothing here
 * worth indexing beyond the landing page and the privacy notice.
 *
 * This blanket-disallows everything and allows back in only the public
 * routes plus the static assets a crawler needs to render a decent result
 * (favicon, icons, the generated OG images, the manifest). Enumerating
 * disallowed paths instead - the previous approach - silently under-blocks
 * any route added later; deny-by-default doesn't have that failure mode.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
      allow: [
        "/$",
        "/legal",
        "/favicon.ico",
        "/icon*",
        "/apple-icon*",
        "/opengraph-image*",
        "/twitter-image*",
        "/manifest.webmanifest",
        "/web-app-manifest-*.png",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
