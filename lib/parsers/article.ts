import domino from "@mixmark-io/domino";
import { makeAsset } from "../media";
import type { Asset } from "../types";

/**
 * Article extraction for blogs and documentation.
 *
 * A tech post is mostly prose, code and diagrams wrapped in a lot of chrome, so
 * the page is scored to find the block that actually holds the writing, the
 * chrome is stripped, and lazy-loaded or responsive images are resolved to a
 * real address before the media pass gets to them.
 */

export interface ArticleMeta {
  title: string;
  author?: string;
  siteName?: string;
  publishedAt?: number;
  description?: string;
  canonical?: string;
  heroImage?: string;
}

export interface ExtractedArticle {
  meta: ArticleMeta;
  /** Cleaned HTML of the article body, ready for markdown conversion. */
  html: string;
  /** Media discovered while resolving lazy and responsive sources. */
  assets: Asset[];
  /** How confident the scoring was, 0..1 — low means it may have grabbed chrome. */
  confidence: number;
}

/** Elements that are never article content. */
const STRIP_TAGS = [
  "script",
  "style",
  "noscript",
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "button",
  "svg",
  "iframe:not([src])",
  "link",
  "meta",
  "template",
];

/** Class and id fragments that mark furniture rather than writing. */
const JUNK_PATTERN =
  /(^|[\s_-])(nav|menu|sidebar|side-bar|footer|header|masthead|banner|promo|advert|advertisement|ads?|sponsor|subscribe|newsletter|signup|sign-up|paywall|cookie|consent|gdpr|social|share|sharing|related|recommend|popular|trending|comment|disqus|breadcrumb|pagination|pager|toolbar|widget|modal|popup|overlay|skip-link|screen-reader|sr-only|visually-hidden|toc|table-of-contents|author-bio|about-author|tags?|meta-info|byline-social|back-to-top|edit-link|hidden)([\s_-]|$)/i;

/** Containers likely to hold the article. */
const CANDIDATE_SELECTOR =
  "article, main, [role=main], .post-content, .entry-content, .article-content, .article-body, .post-body, .markdown-body, .prose, #content, .content, .post, .entry";

export function extractArticle(html: string, baseUrl: string): ExtractedArticle | null {
  const doc = domino.createDocument(html, true);
  const meta = readMeta(doc, baseUrl);

  stripJunk(doc);

  const body = doc.body;
  if (!body) return null;

  const candidates: Element[] = [
    ...Array.from(body.querySelectorAll<Element>(CANDIDATE_SELECTOR)),
    ...Array.from(body.children),
  ];

  let best: { node: Element; score: number } | null = null;
  for (const node of candidates) {
    const score = scoreNode(node);
    if (!best || score > best.score) best = { node, score };
  }

  // Nothing scored well: fall back to the body so something is still saved.
  const chosen = best && best.score > 20 ? best.node : body;
  const assets = resolveMedia(chosen, baseUrl);
  removeEmptyNodes(chosen);

  const text = (chosen.textContent ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 200) return null;

  const bodyText = (body.textContent ?? "").replace(/\s+/g, " ").trim();
  const share = bodyText.length ? text.length / bodyText.length : 0;

  return {
    meta,
    html: chosen.innerHTML ?? "",
    assets,
    // A block holding most of the page's words is very likely the article.
    confidence: Math.max(0, Math.min(1, share)),
  };
}

/* -------------------------------------------------------------------------- */
/* Metadata                                                                   */
/* -------------------------------------------------------------------------- */

function readMeta(doc: Document, baseUrl: string): ArticleMeta {
  const attr = (selector: string, name = "content") =>
    doc.querySelector(selector)?.getAttribute(name)?.trim() || undefined;

  const jsonLd = readJsonLd(doc);

  const title =
    attr('meta[property="og:title"]') ??
    attr('meta[name="twitter:title"]') ??
    jsonLd?.headline ??
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.querySelector("title")?.textContent?.trim() ??
    "";

  const author =
    attr('meta[name="author"]') ??
    attr('meta[property="article:author"]') ??
    jsonLd?.author ??
    doc.querySelector('[rel="author"], .author-name, .byline-name, [itemprop="author"]')
      ?.textContent?.trim() ??
    undefined;

  const published =
    attr('meta[property="article:published_time"]') ??
    attr('meta[name="date"]') ??
    attr('meta[itemprop="datePublished"]') ??
    jsonLd?.datePublished ??
    doc.querySelector("time[datetime]")?.getAttribute("datetime") ??
    undefined;

  const publishedAt = published ? Date.parse(published) : Number.NaN;

  return {
    title: collapse(title),
    author: author ? collapse(author).slice(0, 80) : undefined,
    siteName: attr('meta[property="og:site_name"]') ?? hostOf(baseUrl),
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : undefined,
    description:
      attr('meta[name="description"]') ?? attr('meta[property="og:description"]') ?? undefined,
    canonical: absolute(doc.querySelector('link[rel="canonical"]')?.getAttribute("href"), baseUrl),
    heroImage: absolute(attr('meta[property="og:image"]'), baseUrl),
  };
}

interface JsonLdBits {
  headline?: string;
  author?: string;
  datePublished?: string;
}

function readJsonLd(doc: Document): JsonLdBits | null {
  for (const node of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(node.textContent ?? "");
      const entries: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { "@graph"?: unknown[] })?.["@graph"])
          ? ((parsed as { "@graph": unknown[] })["@graph"] as unknown[])
          : [parsed];

      for (const raw of entries) {
        const entry = raw as Record<string, unknown>;
        const type = String(entry["@type"] ?? "");
        if (!/article|blogposting|newsarticle|techarticle/i.test(type)) continue;
        const author = entry.author as { name?: string } | { name?: string }[] | string | undefined;
        return {
          headline: typeof entry.headline === "string" ? entry.headline : undefined,
          author:
            typeof author === "string"
              ? author
              : Array.isArray(author)
                ? author[0]?.name
                : author?.name,
          datePublished:
            typeof entry.datePublished === "string" ? entry.datePublished : undefined,
        };
      }
    } catch {
      /* a malformed block is simply skipped */
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Cleaning and scoring                                                       */
/* -------------------------------------------------------------------------- */

function stripJunk(doc: Document) {
  for (const selector of STRIP_TAGS) {
    for (const node of Array.from(doc.querySelectorAll(selector))) node.remove();
  }

  for (const node of Array.from(doc.querySelectorAll("[class], [id]"))) {
    const label = `${node.getAttribute("class") ?? ""} ${node.getAttribute("id") ?? ""}`;
    if (!JUNK_PATTERN.test(label)) continue;
    // A block full of prose is kept even if its name looks like furniture.
    const words = (node.textContent ?? "").trim().split(/\s+/).length;
    if (words > 120 && node.querySelectorAll("p").length > 2) continue;
    node.remove();
  }

  for (const node of Array.from(doc.querySelectorAll('[aria-hidden="true"], [hidden]'))) {
    // Icons and toggles, not content.
    if ((node.textContent ?? "").trim().length < 200) node.remove();
  }
}

/** Text-heavy blocks score high; link menus score low. */
function scoreNode(node: Element): number {
  const text = (node.textContent ?? "").trim();
  if (text.length < 200) return 0;

  const paragraphs = node.querySelectorAll("p").length;
  const headings = node.querySelectorAll("h2, h3").length;
  const code = node.querySelectorAll("pre, code").length;
  const images = node.querySelectorAll("img, figure, video").length;

  const linkText = Array.from(node.querySelectorAll("a")).reduce(
    (sum, a) => sum + (a.textContent ?? "").trim().length,
    0,
  );
  const linkDensity = text.length ? linkText / text.length : 1;

  let score = Math.sqrt(text.length);
  score += paragraphs * 12;
  score += headings * 8;
  score += Math.min(code, 20) * 6;
  score += Math.min(images, 20) * 4;
  // A wall of links is a nav or an index page, not an article.
  score *= Math.max(0.1, 1 - linkDensity * 1.4);

  const tag = node.tagName.toLowerCase();
  if (tag === "article" || tag === "main") score *= 1.3;

  return score;
}

function removeEmptyNodes(root: Element) {
  for (const node of Array.from(root.querySelectorAll("p, div, span, li, section"))) {
    const hasMedia = node.querySelector("img, video, audio, pre, table, iframe");
    if (!hasMedia && !(node.textContent ?? "").trim()) node.remove();
  }
}

/* -------------------------------------------------------------------------- */
/* Media resolution                                                           */
/* -------------------------------------------------------------------------- */

const LAZY_ATTRS = [
  "src",
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-lazy",
  "data-echo",
  "data-hi-res-src",
  "data-full-src",
];

/**
 * Rewrites every image and clip to a plain, absolute `src` the media pass can
 * pick up: the largest entry from a `srcset`, the real address behind a lazy
 * placeholder, and the best `<source>` inside a `<picture>`.
 */
function resolveMedia(root: Element, baseUrl: string): Asset[] {
  const assets: Asset[] = [];

  for (const picture of Array.from(root.querySelectorAll("picture"))) {
    const img = picture.querySelector("img");
    const best = Array.from(picture.querySelectorAll("source"))
      .map((s) => pickFromSrcset(s.getAttribute("srcset")))
      .find(Boolean);
    if (img && best) img.setAttribute("src", best);
    // Unwrap so turndown sees a plain image.
    if (img) picture.parentNode?.replaceChild(img, picture);
  }

  for (const img of Array.from(root.querySelectorAll("img"))) {
    const fromSrcset = pickFromSrcset(
      img.getAttribute("srcset") ?? img.getAttribute("data-srcset"),
    );
    const direct = LAZY_ATTRS.map((a) => img.getAttribute(a)).find(
      (v) => v && !v.startsWith("data:image/svg") && !isPlaceholder(v),
    );

    const resolved = absolute(fromSrcset ?? direct ?? undefined, baseUrl);
    if (!resolved) {
      img.remove();
      continue;
    }

    img.setAttribute("src", resolved);
    img.removeAttribute("srcset");

    const alt = img.getAttribute("alt")?.trim() || figureCaption(img) || "";
    if (alt) img.setAttribute("alt", alt);

    const asset = makeAsset({
      url: resolved,
      kind: "image",
      alt,
      width: numberAttr(img, "width"),
      height: numberAttr(img, "height"),
    });
    if (asset) assets.push(asset);
  }

  for (const media of Array.from(root.querySelectorAll("video, audio"))) {
    const direct =
      media.getAttribute("src") ??
      media.querySelector("source")?.getAttribute("src") ??
      media.getAttribute("data-src");
    const resolved = absolute(direct ?? undefined, baseUrl);
    if (!resolved) {
      media.remove();
      continue;
    }
    media.setAttribute("src", resolved);

    // Silent looping video is how most blogs ship animations; keep the poster
    // too so there is something to show before it plays.
    const poster = absolute(media.getAttribute("poster") ?? undefined, baseUrl);
    if (poster) {
      const asset = makeAsset({ url: poster, kind: "image", alt: "Video poster" });
      if (asset) assets.push(asset);
    }

    const asset = makeAsset({
      url: resolved,
      kind: media.tagName.toLowerCase() === "audio" ? "audio" : "video",
      alt: media.getAttribute("title") ?? figureCaption(media) ?? "",
    });
    if (asset) assets.push(asset);
  }

  return assets;
}

/** Picks the widest candidate from a `srcset`. */
function pickFromSrcset(srcset: string | null): string | undefined {
  if (!srcset) return undefined;
  const entries = srcset
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [url, descriptor] = part.split(/\s+/, 2);
      const width = descriptor?.endsWith("w") ? Number.parseInt(descriptor, 10) : 0;
      const density = descriptor?.endsWith("x") ? Number.parseFloat(descriptor) * 1000 : 0;
      return { url, weight: width || density || 1 };
    })
    .filter((e) => e.url);

  if (!entries.length) return undefined;
  return entries.reduce((best, e) => (e.weight > best.weight ? e : best)).url;
}

/** Tiny inline blurs and spacer gifs are placeholders, not the real picture. */
function isPlaceholder(value: string): boolean {
  return (
    value.startsWith("data:image/gif;base64,R0lGOD") ||
    /\b(placeholder|blank|spacer|lazy|loading)\b/i.test(value)
  );
}

function figureCaption(node: Element): string | undefined {
  const figure = node.closest?.("figure");
  const caption = figure?.querySelector("figcaption")?.textContent?.trim();
  return caption ? collapse(caption).slice(0, 200) : undefined;
}

function numberAttr(node: Element, name: string): number | undefined {
  const value = Number.parseInt(node.getAttribute(name) ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/* -------------------------------------------------------------------------- */

function absolute(href: string | null | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:")) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return undefined;
  }
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
