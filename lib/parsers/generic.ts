import type { ChatMessage, ExtractResult, Role, SourceId } from "../types";
import { uid } from "../utils";
import { type ArticleMeta, extractArticle } from "./article";
import {
  collectEmbeddedJson,
  htmlToMarkdown,
  mainContent,
  pageTitle,
  siteIcon,
  stripTags,
} from "./html";
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
        favicon: siteIcon(page.body, page.finalUrl),
        strategy: "generic:embedded-json",
        warning: notes(
          "Read from the page's embedded data. Check that nothing important is missing before you rely on it offline.",
          page.compatibility ? COMPATIBILITY_NOTE : undefined,
        ),
      };
    }
  }

  // Blogs and docs: score the page, keep the writing, resolve lazy media.
  const article = extractArticle(page.body, page.finalUrl);
  if (article) {
    const readable = htmlToMarkdown(article.html);
    if (stripTags(readable).length >= 120) {
      return {
        ok: true,
        title: article.meta.title || title,
        source,
        sourceUrl: article.meta.canonical ?? page.finalUrl,
        originalAt: article.meta.publishedAt,
        messages: [
          {
            id: uid("m"),
            role: "assistant",
            content: withCredit(readable, article.meta, page.finalUrl),
            assets: article.assets.length ? article.assets : undefined,
          },
        ],
        assets: article.assets.length ? article.assets : undefined,
        favicon: siteIcon(page.body, page.finalUrl),
        strategy: "article:readable",
        warning: notes(
          article.confidence < 0.35
            ? "Losto was not fully certain which part of the page was the article, so some of the site's navigation may have come along."
            : undefined,
          page.compatibility ? COMPATIBILITY_NOTE : undefined,
        ),
      };
    }
  }

  // Nothing scored as an article - fall back to the whole main region.
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
    favicon: siteIcon(page.body, page.finalUrl),
    strategy: "generic:article",
    warning: notes(
      "Saved as a single article - this source has no public chat API, so the question/answer split may be missing.",
      page.compatibility ? COMPATIBILITY_NOTE : undefined,
    ),
  };
}

/** Joins the article-confidence note with the compatibility note, if any. */
function notes(...parts: (string | undefined)[]): string | undefined {
  const kept = parts.filter(Boolean);
  return kept.length ? kept.join(" ") : undefined;
}

/**
 * The site refused an identified request, so it was fetched as a browser. Worth
 * saying plainly rather than quietly switching disguises.
 */
const COMPATIBILITY_NOTE =
  "This site refused a request that identified itself, so Losto fetched it as a browser would. Its robots.txt allows this page.";

/**
 * Every saved article opens with who wrote it and where it came from. Keeping
 * the credit attached is both the decent thing to do and what makes a stored
 * copy read as personal reading rather than an anonymous reproduction.
 */
function withCredit(markdown: string, meta: ArticleMeta, fallbackUrl: string): string {
  const origin = meta.canonical ?? fallbackUrl;
  const bits: string[] = [];
  if (meta.author) bits.push(`By ${meta.author}`);
  if (meta.siteName) bits.push(meta.siteName);
  if (meta.publishedAt) {
    bits.push(new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(meta.publishedAt));
  }

  const credit = [
    bits.length ? `> ${bits.join(" · ")}` : null,
    `> Saved from [${hostOf(origin)}](${origin})`,
  ]
    .filter(Boolean)
    .join("\n");

  return `${credit}\n\n${markdown.trim()}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
