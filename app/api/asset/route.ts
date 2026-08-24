import type { NextRequest } from "next/server";
import { isPrivateHost } from "@/lib/parsers";
import { ASSET_LIMIT, callerKey, consume, tooManyRequests } from "@/lib/ratelimit";
import { BROWSER_UA } from "@/lib/parsers/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 64 * 1024 * 1024;
const TIMEOUT_MS = 45_000;

/**
 * Streams one picture or clip back to the browser so it can be stored offline.
 * Media URLs from the assistants are signed and short-lived, and CORS stops the
 * page fetching them directly, so the copy has to happen through here.
 *
 * Only media content types are relayed, the size is capped, and private network
 * addresses are refused. Set LOSTO_ASSET_HOSTS to a comma-separated host list to
 * narrow it further on a shared deployment.
 */
export async function GET(request: NextRequest) {
  const limit = consume(callerKey(request), ASSET_LIMIT);
  if (!limit.ok) return tooManyRequests(limit);

  const target = request.nextUrl.searchParams.get("url");
  if (!target) return bad("No url parameter.");

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return bad("Not a valid url.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return bad("Unsupported protocol.");
  if (isPrivateHost(url.hostname)) return bad("Refusing to fetch a private address.");
  if (!hostAllowed(url.hostname)) return bad("That host is not on the allow list.", 403);

  let upstream: Response;
  try {
    upstream = await fetch(url.href, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": BROWSER_UA,
        accept: "image/avif,image/webp,image/*,video/*,audio/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: `${url.origin}/`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return bad(`Could not reach the media (${message}).`, 502);
  }

  if (!upstream.ok || !upstream.body) {
    // Pass rate limiting straight through so the client can back off and retry.
    if (upstream.status === 429 || upstream.status === 503) {
      const retryAfter = upstream.headers.get("retry-after");
      return Response.json(
        { ok: false, error: "The source is rate-limiting downloads." },
        {
          status: upstream.status,
          headers: {
            "cache-control": "no-store",
            ...(retryAfter ? { "retry-after": retryAfter } : {}),
          },
        },
      );
    }
    return bad(`The source returned ${upstream.status} for that file.`, 502);
  }

  const mime = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!isMedia(mime)) {
    return bad(`That link is not media (${mime || "unknown type"}).`, 415);
  }

  const declared = Number(upstream.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_BYTES) {
    return bad("That file is too large to store.", 413);
  }

  return new Response(capped(upstream.body), {
    status: 200,
    headers: {
      "content-type": mime,
      "cache-control": "no-store",
      "x-losto-source": url.hostname,
      ...(declared ? { "content-length": String(declared) } : {}),
    },
  });
}

/** Aborts a response that keeps going past the cap despite its headers. */
function capped(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let total = 0;
  const reader = body.getReader();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        controller.error(new Error("Media exceeded the size cap"));
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });
}

function isMedia(mime: string): boolean {
  return mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/");
}

function hostAllowed(hostname: string): boolean {
  const list = process.env.LOSTO_ASSET_HOSTS;
  if (!list) return true;
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return list
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function bad(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status, headers: { "cache-control": "no-store" } });
}
