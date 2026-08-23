import type { ExtractError, SourceId } from "../types";

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const TIMEOUT_MS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;

/** Thrown by parsers; the route handler turns it into a typed JSON error. */
export class ExtractProblem extends Error {
  code: ExtractError["code"];
  hint?: string;

  constructor(code: ExtractError["code"], message: string, hint?: string) {
    super(message);
    this.name = "ExtractProblem";
    this.code = code;
    this.hint = hint;
  }
}

export interface FetchedPage {
  status: number;
  finalUrl: string;
  body: string;
  contentType: string;
}

export async function fetchPage(
  url: string,
  init: { accept?: string; referer?: string; headers?: Record<string, string> } = {},
): Promise<FetchedPage> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": BROWSER_UA,
        accept:
          init.accept ??
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        ...(init.referer ? { referer: init.referer } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout|abort/i.test(msg)) {
      throw new ExtractProblem(
        "network",
        "The source took too long to respond.",
        "Check your connection and try again.",
      );
    }
    throw new ExtractProblem("network", `Could not reach the link (${msg}).`);
  }

  const body = await readCapped(res);

  if (isBotChallenge(res, body)) {
    throw new ExtractProblem(
      "blocked",
      "This source is blocking automated requests.",
      "Open the chat in your browser, copy the text, then use “Paste text” here - formatting is kept.",
    );
  }

  return {
    status: res.status,
    finalUrl: res.url || url,
    body,
    contentType: res.headers.get("content-type") ?? "",
  };
}

/**
 * Some hosts sit behind a bot check that answers with an interstitial rather
 * than the resource. Saying so beats reporting it as a missing chat.
 */
function isBotChallenge(res: Response, body: string): boolean {
  if (res.status !== 403 && res.status !== 503) return false;
  if (res.headers.has("cf-mitigated")) return true;
  const head = body.slice(0, 4000);
  return (
    /<title>\s*(Just a moment|Attention Required|Access denied)/i.test(head) ||
    /__cf_chl_|cf-browser-verification|challenge-platform/i.test(head)
  );
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const decoder = new TextDecoder("utf-8");
  const chunks: string[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}

/** Maps a non-OK status onto the friendliest explanation we can give. */
export function statusProblem(status: number, source: SourceId): ExtractProblem {
  const label = source === "unknown" ? "page" : "chat";
  if (status === 404) {
    return new ExtractProblem(
      "not_found",
      `That ${label} no longer exists.`,
      "The share link may have been deleted or turned off by whoever created it.",
    );
  }
  if (status === 401 || status === 403) {
    return new ExtractProblem(
      "private",
      `That ${label} is not publicly shared.`,
      "Open the chat, create a fresh public share link, then paste that one.",
    );
  }
  if (status === 429) {
    return new ExtractProblem(
      "blocked",
      "The source is rate-limiting requests right now.",
      "Wait a minute and try again.",
    );
  }
  if (status >= 500) {
    return new ExtractProblem("network", `The source returned an error (${status}).`);
  }
  return new ExtractProblem("unknown", `Unexpected response from the source (${status}).`);
}
