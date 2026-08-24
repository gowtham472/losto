import { mapOutsideCode } from "./markdown";
import type { Asset, AssetKind } from "./types";

/**
 * Markdown keeps pointing at media through this scheme after import, so the
 * reader can swap in the locally stored blob instead of a URL that has expired.
 */
export const ASSET_SCHEME = "losto-asset:";

export function assetRef(id: string): string {
  return `${ASSET_SCHEME}${id}`;
}

export function parseAssetRef(src: string | undefined): string | null {
  if (!src?.startsWith(ASSET_SCHEME)) return null;
  return src.slice(ASSET_SCHEME.length) || null;
}

/**
 * Stable id derived from the URL, so re-importing the same chat reuses blobs
 * already on the device. Two rounds of FNV-1a give 16 hex characters.
 */
export function assetId(url: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    a ^= code;
    a = Math.imul(a, 0x01000193) >>> 0;
    b ^= code + i;
    b = Math.imul(b, 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|ico)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(\?|#|$)/i;

export function kindForUrl(url: string, mime?: string): AssetKind | null {
  if (mime) {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
  }
  if (embedInfo(url)) return "embed";
  if (IMAGE_EXT.test(url)) return "image";
  if (VIDEO_EXT.test(url)) return "video";
  if (AUDIO_EXT.test(url)) return "audio";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Embedded players                                                           */
/* -------------------------------------------------------------------------- */

export interface EmbedInfo {
  provider: string;
  id: string;
  /** Thumbnail we can store for offline, when the provider exposes a stable one. */
  poster?: string;
  watchUrl: string;
}

export function embedInfo(raw: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? youtube(id) : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const id =
      url.searchParams.get("v") ??
      url.pathname.match(/\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,})/)?.[1];
    return id ? youtube(id) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{6,})/)?.[1];
    return id
      ? { provider: "vimeo", id, watchUrl: `https://vimeo.com/${id}` }
      : null;
  }
  if (host === "loom.com") {
    const id = url.pathname.match(/\/share\/([a-f0-9]{16,})/)?.[1];
    return id
      ? { provider: "loom", id, watchUrl: `https://www.loom.com/share/${id}` }
      : null;
  }
  return null;
}

function youtube(id: string): EmbedInfo {
  return {
    provider: "youtube",
    id,
    poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Building assets                                                            */
/* -------------------------------------------------------------------------- */

export function makeAsset(input: {
  url: string;
  kind?: AssetKind;
  alt?: string;
  title?: string;
  mime?: string;
  width?: number;
  height?: number;
  prompt?: string;
  unavailable?: boolean;
  unavailableReason?: string;
}): Asset | null {
  const embed = embedInfo(input.url);
  const kind = input.kind ?? kindForUrl(input.url, input.mime);
  if (!kind) return null;

  if (kind === "embed" && embed) {
    return {
      id: assetId(embed.watchUrl),
      kind: "embed",
      url: embed.watchUrl,
      fetchUrl: embed.poster,
      provider: embed.provider,
      alt: input.alt,
      title: input.title ?? input.alt,
    };
  }

  return {
    id: assetId(input.url),
    kind,
    url: input.url,
    fetchUrl: input.unavailable ? undefined : input.url,
    mime: input.mime,
    width: input.width,
    height: input.height,
    alt: input.alt,
    title: input.title,
    prompt: input.prompt,
    unavailable: input.unavailable,
    unavailableReason: input.unavailableReason,
  };
}

/**
 * The `/favicon.ico` every site answers, as an asset. Used to backfill items
 * saved before icons existed, and to repair one whose icon never downloaded -
 * neither case has the original page HTML to read a better icon from.
 */
export function originIconAsset(sourceUrl: string | undefined): Asset | null {
  if (!sourceUrl) return null;
  try {
    const { origin, hostname, protocol } = new URL(sourceUrl);
    if (protocol !== "http:" && protocol !== "https:") return null;
    return makeAsset({
      url: `${origin}/favicon.ico`,
      kind: "image",
      alt: hostname.replace(/^www\./, ""),
    });
  } catch {
    return null;
  }
}

export function dedupeAssets(assets: Asset[]): Asset[] {
  const byId = new Map<string, Asset>();
  for (const asset of assets) {
    const existing = byId.get(asset.id);
    // Later mentions often carry better alt text; keep the richest version.
    byId.set(
      asset.id,
      existing
        ? {
            ...existing,
            ...asset,
            alt: asset.alt || existing.alt,
            prompt: asset.prompt || existing.prompt,
            width: asset.width ?? existing.width,
            height: asset.height ?? existing.height,
          }
        : asset,
    );
  }
  return [...byId.values()];
}

/* -------------------------------------------------------------------------- */
/* Markdown rewriting                                                         */
/* -------------------------------------------------------------------------- */

const IMAGE_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const LINK_RE = /(^|[^!])\[([^\]]*)\]\(\s*<?(https?:\/\/[^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)/g;
const BARE_RE = /(^|\s)(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Swaps every picture, clip and player in the markdown for an asset reference,
 * returning the media it found. Fenced code and inline code are left alone.
 */
export function rewriteMedia(
  markdown: string,
  options: { baseUrl?: string } = {},
): { markdown: string; assets: Asset[] } {
  const assets: Asset[] = [];

  const absolute = (href: string): string | null => {
    try {
      return options.baseUrl ? new URL(href, options.baseUrl).href : new URL(href).href;
    } catch {
      return null;
    }
  };

  const next = mapOutsideCode(markdown, (segment) => {
    let out = segment.replace(IMAGE_RE, (whole, alt: string, href: string, title?: string) => {
      if (href.startsWith(ASSET_SCHEME)) return whole;
      const url = absolute(href);
      if (!url) return whole;
      const asset = makeAsset({ url, kind: kindForUrl(url) ?? "image", alt, title });
      if (!asset) return whole;
      assets.push(asset);
      return `![${alt}](${assetRef(asset.id)})`;
    });

    // Links that point straight at a media file, or at a known player.
    out = out.replace(LINK_RE, (whole, lead: string, text: string, href: string) => {
      const url = absolute(href);
      if (!url) return whole;
      const kind = kindForUrl(url);
      if (!kind || kind === "image") return whole;
      const asset = makeAsset({ url, kind, alt: text, title: text });
      if (!asset) return whole;
      assets.push(asset);
      return `${lead}![${text}](${assetRef(asset.id)})`;
    });

    // Bare player links on their own get the same treatment.
    out = out.replace(BARE_RE, (whole, lead: string, href: string) => {
      const url = absolute(href);
      if (!url) return whole;
      const kind = kindForUrl(url);
      if (kind !== "embed" && kind !== "video") return whole;
      const asset = makeAsset({ url, kind });
      if (!asset) return whole;
      assets.push(asset);
      return `${lead}![](${assetRef(asset.id)})`;
    });

    return out;
  });

  return { markdown: next, assets: dedupeAssets(assets) };
}

/** Adds already-known assets (attachments, asset pointers) to a message body. */
export function appendAssets(markdown: string, assets: Asset[]): string {
  if (!assets.length) return markdown;
  const refs = assets.map((a) => `![${a.alt ?? ""}](${assetRef(a.id)})`).join("\n\n");
  return markdown.trim() ? `${markdown.trim()}\n\n${refs}` : refs;
}

export function humanKind(kind: AssetKind): string {
  return kind === "embed" ? "video" : kind;
}
