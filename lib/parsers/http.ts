import type { ExtractError, SourceId } from "../types";
import { BOT_UA, checkUrl } from "./robots";

/**
 * Losto identifies itself rather than pretending to be a browser. Sites can
 * then allow or refuse it deliberately. A self-hoster who needs a different
 * string can set LOSTO_USER_AGENT, but the honest default is what ships.
 */
export const BROWSER_UA = process.env.LOSTO_USER_AGENT ?? BOT_UA;

/**
 * Some sites answer anything that does not look like a browser with a 403, even
 * on paths their own robots.txt allows for `*`. Medium is one: it refuses an
 * identified agent, and refuses even a real Chrome string with a Losto token
 * appended. When that happens on a path robots.txt permits, the request is made
 * once more as a plain browser and the saved item says so.
 *
 * Set LOSTO_STRICT_UA=1 to turn the retry off and always stay identified.
 */
const COMPATIBILITY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const STRICT_UA = process.env.LOSTO_STRICT_UA === "1";

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
  /** True when the site refused the identified agent and a browser UA was used. */
  compatibility?: boolean;
  /**
   * Cookies the page handed back, ready to send on follow-up requests to the
   * same site. A browser loading a shared page keeps its session for the images
   * that page references; a stateless fetch would drop it.
   */
  cookies?: string;
}

/** Collapses Set-Cookie headers into a Cookie header value. */
function collectCookies(res: Response): string | undefined {
  const jar = res.headers.getSetCookie?.() ?? [];
  const pairs = jar
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair?.includes("=")));
  return pairs.length ? Array.from(new Set(pairs)).join("; ") : undefined;
}

export async function fetchPage(
  url: string,
  init: {
    accept?: string;
    referer?: string;
    headers?: Record<string, string>;
    /** Set to "skip" only for a path the site has already told us is fine. */
    robots?: "enforce" | "skip";
  } = {},
): Promise<FetchedPage> {
  const enforceRobots = init.robots !== "skip";

  if (enforceRobots) {
    const verdict = await checkUrl(new URL(url));
    if (!verdict.allowed) throw robotsRefusal();
    if (verdict.crawlDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, verdict.crawlDelayMs));
    }
  }

  const attempt = async (agent: string) => {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": agent,
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
    return { res, body: await readCapped(res) };
  };

  let { res, body } = await attempt(BROWSER_UA);
  let compatibility = false;

  if (isBotChallenge(res, body)) {
    // The site's stated policy is robots.txt. If that permits this path, the
    // 403 is a heuristic rather than a decision, so ask once more as a browser.
    if (STRICT_UA || !enforceRobots) throw botRefusal();
    ({ res, body } = await attempt(COMPATIBILITY_UA));
    compatibility = true;
    if (isBotChallenge(res, body)) throw botRefusal();
  }

  // A redirect can land on a different host with its own rules.
  const finalUrl = res.url || url;
  if (enforceRobots && originOf(finalUrl) !== originOf(url)) {
    const verdict = await checkUrl(new URL(finalUrl));
    if (!verdict.allowed) throw robotsRefusal();
  }

  return {
    status: res.status,
    finalUrl,
    body,
    contentType: res.headers.get("content-type") ?? "",
    compatibility,
    cookies: collectCookies(res),
  };
}

function robotsRefusal() {
  return new ExtractProblem(
    "blocked",
    "This site asks automated tools not to fetch that address.",
    "Losto respects robots.txt. Open the page yourself and use “Paste text” instead.",
  );
}

function botRefusal() {
  return new ExtractProblem(
    "blocked",
    "This source is blocking automated requests.",
    "Open the page in your browser, copy the text, then use “Paste text” here - formatting is kept.",
  );
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
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
  const isChat = source !== "unknown";
  const label = isChat ? "chat" : "page";

  if (status === 404) {
    return new ExtractProblem(
      "not_found",
      `That ${label} no longer exists.`,
      isChat
        ? "The share link may have been deleted or turned off by whoever created it."
        : "Check the address, or find the page again and copy the link from the address bar.",
    );
  }
  if (status === 401 || status === 403) {
    return new ExtractProblem(
      "private",
      isChat ? "That chat is not publicly shared." : "That page is not public.",
      isChat
        ? "Open the chat, create a fresh public share link, then paste that one."
        : "It may sit behind a login or paywall. Losto will not work around that — open it yourself and use “Paste text”.",
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
