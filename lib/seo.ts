/**
 * Canonical site identity, shared by every place that needs to know Losto's
 * public URL: root metadata, sitemap.ts, robots.ts and the JSON-LD blocks.
 *
 * Set `NEXT_PUBLIC_SITE_URL` if the deployed origin ever moves off
 * losto.doodlebytestudio.in - everything below follows from it, so there is
 * only one place to change.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://losto.doodlebytestudio.in"
).replace(/\/+$/, "");

export const SITE_NAME = "Losto";

export const DEFAULT_TITLE = "Losto - AI answers, saved offline";

export const DEFAULT_DESCRIPTION =
  "Paste a ChatGPT, Claude or Perplexity share link, or any blog post, and keep the whole thing on your phone - answers, code, tables and formulas. Works with the wifi off, no account, nothing uploaded.";

/** BCP 47 tag Open Graph expects, not a routing locale - Losto only ships English. */
export const OG_LOCALE = "en_US";
