import type { ChatMessage, ExtractResult, Role, SourceId } from "../types";
import { uid } from "../utils";
import { collectEmbeddedJson, htmlToMarkdown, mainContent, pageTitle, stripTags } from "./html";
import { ExtractProblem, fetchPage, statusProblem } from "./http";

const ROLE_KEYS = ["role", "sender", "author", "speaker", "from"];
const TEXT_KEYS = ["content", "text", "message", "body", "answer", "markdown"];

/**
 * Last-resort extractor: tries to spot a conversation in whatever JSON the page
 * embedded, then falls back to reading the page as an article.
 */
export async function parseGeneric(url: string, source: SourceId): Promise<ExtractResult> {
  const page = await fetchPage(url);
  if (page.status !== 200) throw statusProblem(page.status, source);
  if (!/html|text|json/i.test(page.contentType) && page.contentType) {
    throw new ExtractProblem("unsupported", "That link is not a readable page.");
  }

  const title = pageTitle(page.body);

  for (const blob of collectEmbeddedJson(page.body)) {
    const messages = conversationFrom(blob);
    if (messages.length >= 2) {
      return {
        ok: true,
        title,
        source,
        sourceUrl: page.finalUrl,
        messages,
        strategy: "generic:embedded-json",
        warning:
          "Read from the page's embedded data. Check that nothing important is missing before you rely on it offline.",
      };
    }
  }

  const markdown = htmlToMarkdown(mainContent(page.body));
  const plain = stripTags(markdown);
  if (plain.length < 120) {
    throw new ExtractProblem(
      "empty",
      "There was no readable content at that link.",
      "The page probably renders its content with JavaScript. Paste the text instead.",
    );
  }

  return {
    ok: true,
    title,
    source,
    sourceUrl: page.finalUrl,
    messages: [{ id: uid("m"), role: "assistant", content: markdown }],
    strategy: "generic:article",
    warning:
      "Saved as a single article - this source has no public chat API, so the question/answer split may be missing.",
  };
}

/** Finds the longest array that looks like a list of chat turns. */
function conversationFrom(root: unknown): ChatMessage[] {
  let best: ChatMessage[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  let steps = 0;

  while (queue.length && steps < 200_000) {
    steps++;
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      const messages = asTurns(node);
      if (messages.length > best.length) best = messages;
      for (const item of node) queue.push(item);
      continue;
    }
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return best;
}

function asTurns(list: unknown[]): ChatMessage[] {
  if (list.length < 2) return [];
  const out: ChatMessage[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;

    const roleKey = ROLE_KEYS.find((k) => typeof record[k] === "string");
    const textKey = TEXT_KEYS.find((k) => typeof record[k] === "string" && record[k] !== "");
    if (!roleKey || !textKey) return [];

    const raw = String(record[roleKey]).toLowerCase();
    const role: Role = /user|human|you|question|prompt/.test(raw) ? "user" : "assistant";
    const content = String(record[textKey]).trim();
    if (!content) continue;

    out.push({ id: uid("m"), role, content });
  }

  // A believable transcript alternates; a list of identical roles is data, not chat.
  return out.some((m) => m.role === "user") && out.some((m) => m.role === "assistant") ? out : [];
}
