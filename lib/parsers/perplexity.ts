import type { ChatMessage, ExtractResult } from "../types";
import { uid } from "../utils";
import { findNodes, parseMaybeJsonString } from "./html";
import { ExtractProblem, fetchPage, statusProblem } from "./http";

/** `/search/<slug>-<id>`, `/page/<slug>` and bare thread UUIDs all work. */
function threadSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last && last.length >= 4 ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

export async function parsePerplexity(url: string): Promise<ExtractResult> {
  const slug = threadSlug(url);
  if (!slug) {
    throw new ExtractProblem("bad_url", "That does not look like a Perplexity thread link.");
  }

  // Perplexity renders entirely on the client, so the REST thread is the only way in.
  let api: Awaited<ReturnType<typeof fetchPage>>;
  try {
    api = await fetchPage(
      `https://www.perplexity.ai/rest/thread/${encodeURIComponent(slug)}?with_parent_info=true&source=default`,
      { accept: "application/json", referer: url },
    );
  } catch (err) {
    // Perplexity sits behind a bot check that rejects on the TLS handshake, so
    // no user agent gets through. Say that plainly instead of implying a retry
    // might help.
    if (err instanceof ExtractProblem && err.code === "blocked") {
      throw new ExtractProblem(
        "blocked",
        "Perplexity does not allow threads to be fetched by other software.",
        "Open the thread, select the answer, copy it, then use “Paste text” here - formatting, tables and code are kept.",
      );
    }
    throw err;
  }

  if (api.status !== 200) {
    if (api.status === 400 || api.status === 404) {
      throw new ExtractProblem(
        "not_found",
        "That Perplexity thread could not be found.",
        "Copy the link straight from the Share button on the thread.",
      );
    }
    throw statusProblem(api.status, "perplexity");
  }

  let data: unknown;
  try {
    data = JSON.parse(api.body);
  } catch {
    throw new ExtractProblem("empty", "Perplexity returned an unreadable response.");
  }

  const entries = findNodes(
    data,
    (n) => typeof n.query_str === "string" && (n.query_str as string).trim().length > 0,
    60,
  );
  if (!entries.length) {
    throw new ExtractProblem(
      "empty",
      "Could not read that Perplexity thread.",
      "Make sure the thread is shared publicly.",
    );
  }

  const messages: ChatMessage[] = [];
  let originalAt: number | undefined;

  for (const entry of entries) {
    const question = String(entry.query_str).trim();
    const created = toTime(entry.updated_datetime ?? entry.created_datetime ?? entry.timestamp);
    if (created && !originalAt) originalAt = created;

    messages.push({ id: uid("m"), role: "user", content: question, createdAt: created });

    const answer = readAnswer(entry);
    if (answer.text.trim()) {
      messages.push({
        id: uid("m"),
        role: "assistant",
        content: answer.text.trim(),
        citations: answer.citations.length ? answer.citations : undefined,
        model: typeof entry.display_model === "string" ? entry.display_model : undefined,
        createdAt: created,
      });
    }
  }

  if (!messages.some((m) => m.role === "assistant")) {
    throw new ExtractProblem("empty", "That Perplexity thread has no answers to save yet.");
  }

  const first = entries[0];
  return {
    ok: true,
    title: typeof first.thread_title === "string" ? first.thread_title : String(first.query_str),
    source: "perplexity",
    sourceUrl: url,
    originalAt,
    messages,
    strategy: "perplexity:rest-thread",
  };
}

/** The answer body has moved around across versions, so probe several shapes. */
function readAnswer(entry: Record<string, unknown>): {
  text: string;
  citations: { title?: string; url: string }[];
} {
  const chunks: string[] = [];

  const blocks = entry.blocks;
  if (Array.isArray(blocks)) {
    for (const raw of blocks) {
      const block = raw as Record<string, unknown>;
      const markdown = block.markdown_block as Record<string, unknown> | undefined;
      if (typeof markdown?.answer === "string") chunks.push(markdown.answer);
      const plan = block.plan_block as Record<string, unknown> | undefined;
      if (!markdown && typeof plan?.final === "string") chunks.push(plan.final);
    }
  }

  if (!chunks.length) {
    const parsed = parseMaybeJsonString(entry.text);
    if (typeof parsed === "string") {
      chunks.push(parsed);
    } else if (parsed && typeof parsed === "object") {
      for (const node of findNodes(parsed, (n) => typeof n.answer === "string", 20)) {
        const inner = parseMaybeJsonString(node.answer);
        chunks.push(typeof inner === "string" ? inner : String(node.answer));
      }
    }
  }

  const citations: { title?: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const node of findNodes(entry, (n) => typeof n.url === "string" && "name" in n, 40)) {
    const url = String(node.url);
    if (seen.has(url) || !/^https?:/i.test(url)) continue;
    seen.add(url);
    citations.push({ url, title: typeof node.name === "string" ? node.name : undefined });
  }

  return { text: dedupe(chunks).join("\n\n"), citations };
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = s.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toTime(value: unknown): number | undefined {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}
