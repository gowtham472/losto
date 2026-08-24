import type { NextRequest } from "next/server";
import { ExtractProblem, extractChat } from "@/lib/parsers";
import { EXTRACT_LIMIT, callerKey, consume, tooManyRequests } from "@/lib/ratelimit";
import { detectSource } from "@/lib/sources";
import type { ExtractError } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The only server-side piece of Losto: share links cannot be fetched from the
 * browser because of CORS, so the extraction happens here. Nothing is stored.
 */
export async function GET(request: NextRequest) {
  const limit = consume(callerKey(request), EXTRACT_LIMIT);
  if (!limit.ok) return tooManyRequests(limit);

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return fail("bad_url", "No link was provided.", "unknown");
  return handle(url);
}

export async function POST(request: NextRequest) {
  const limit = consume(callerKey(request), EXTRACT_LIMIT);
  if (!limit.ok) return tooManyRequests(limit);

  let url: unknown;
  try {
    ({ url } = (await request.json()) as { url?: unknown });
  } catch {
    return fail("bad_url", "Malformed request.", "unknown");
  }
  if (typeof url !== "string" || !url.trim()) {
    return fail("bad_url", "No link was provided.", "unknown");
  }
  return handle(url.trim());
}

async function handle(url: string) {
  try {
    const result = await extractChat(url);
    return Response.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const source = detectSource(url);
    if (err instanceof ExtractProblem) {
      return fail(err.code, err.message, source, err.hint);
    }
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return fail("unknown", message, source);
  }
}

function fail(
  code: ExtractError["code"],
  error: string,
  source: ExtractError["source"],
  hint?: string,
) {
  const status =
    code === "bad_url" || code === "unsupported"
      ? 400
      : code === "not_found"
        ? 404
        : code === "private"
          ? 403
          : code === "network"
            ? 504
            : 422;
  const body: ExtractError = { ok: false, error, code, source, hint };
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
