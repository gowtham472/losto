import { dedupeAssets, makeAsset, rewriteMedia } from "../media";
import { detectSource, sourceInfo } from "../sources";
import type { Asset, ChatMessage, ExtractResult, SourceId } from "../types";
import { deriveTitle } from "../utils";
import { parseChatGpt } from "./chatgpt";
import { parseClaude } from "./claude";
import { parseGeneric } from "./generic";
import { ExtractProblem } from "./http";

export { ExtractProblem } from "./http";

export async function extractChat(rawUrl: string): Promise<ExtractResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExtractProblem("bad_url", "That is not a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ExtractProblem("bad_url", "Only http and https links can be saved.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new ExtractProblem("bad_url", "Local and private addresses cannot be fetched.");
  }

  const source: SourceId = detectSource(url.href);

  /*
   * The kill switch. Every source is fetched by default, along the one path its
   * own robots.txt permits. If a source ever objects, flipping `fetchable` in
   * lib/sources.ts stops Losto calling them at all and sends readers to the
   * copy-and-paste route instead. Nothing else has to change.
   */
  if (!sourceInfo(source).fetchable) {
    throw new ExtractProblem(
      "paste_only",
      `Losto no longer fetches ${sourceInfo(source).label} conversations.`,
      "Open the chat, copy it, and paste it here. Formatting, code and tables are kept.",
    );
  }

  const result = await run(source, url.href);
  const withMedia = collectMedia(result, url.href);

  // Every source occasionally omits a title; the opening question is a fine one.
  const title = withMedia.title?.trim() || deriveTitle(withMedia.messages);
  return { ...withMedia, title, source: withMedia.source ?? source };
}

/**
 * One pass over every message that turns pictures, clips and player links into
 * `losto-asset:` references and lifts the media list to the top level, so the
 * client has a single download queue regardless of which parser ran.
 */
function collectMedia(result: ExtractResult, baseUrl: string): ExtractResult {
  const all: Asset[] = [];
  // The site's own mark, so a saved item shows who published it rather than a
  // generic tile. Parsers that read HTML supply a better icon than the default.
  const favicon = result.favicon ?? defaultFavicon(baseUrl);
  if (favicon) all.push(favicon);

  const messages: ChatMessage[] = result.messages.map((message) => {
    const body = rewriteMedia(message.content, { baseUrl });
    const thinking = message.thinking
      ? rewriteMedia(message.thinking, { baseUrl })
      : null;

    // Assets a parser attached directly (asset pointers, attachments) come first.
    const assets = dedupeAssets([
      ...(message.assets ?? []),
      ...body.assets,
      ...(thinking?.assets ?? []),
    ]);
    all.push(...assets);

    return {
      ...message,
      content: body.markdown,
      thinking: thinking ? thinking.markdown : message.thinking,
      assets: assets.length ? assets : undefined,
    };
  });

  const assets = dedupeAssets(all);
  return { ...result, messages, assets: assets.length ? assets : undefined, favicon };
}

/** Every site answers /favicon.ico, so there is always something to try. */
function defaultFavicon(baseUrl: string): Asset | undefined {
  try {
    const { origin, hostname } = new URL(baseUrl);
    return (
      makeAsset({
        url: `${origin}/favicon.ico`,
        kind: "image",
        alt: hostname.replace(/^www\./, ""),
      }) ?? undefined
    );
  } catch {
    return undefined;
  }
}

function run(source: SourceId, url: string): Promise<ExtractResult> {
  switch (source) {
    case "chatgpt":
      return parseChatGpt(url);
    case "claude":
      return parseClaude(url);
    default:
      return parseGeneric(url, source);
  }
}

/** Blocks SSRF against the deployment's own network. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h === "[::1]") {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}
