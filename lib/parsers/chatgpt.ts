import type { ChatMessage, ExtractResult, Role } from "../types";
import { uid } from "../utils";
import { collectEmbeddedJson, findNodes } from "./html";
import { ExtractProblem, fetchPage, statusProblem } from "./http";

/** `/share/<uuid>`, `/share/e/<uuid>` and the legacy chat.openai.com form. */
export function shareId(url: string): string | null {
  const m = url.match(/\/share\/(?:e\/)?([A-Za-z0-9-]{8,})/);
  return m ? m[1].replace(/[^A-Za-z0-9-].*$/, "") : null;
}

export async function parseChatGpt(url: string): Promise<ExtractResult> {
  const id = shareId(url);
  if (!id) {
    throw new ExtractProblem(
      "bad_url",
      "That does not look like a ChatGPT share link.",
      "It should look like https://chatgpt.com/share/xxxxxxxx-xxxx-…",
    );
  }

  // The public share endpoint answers without a session, so try it first.
  const api = await fetchPage(`https://chatgpt.com/backend-api/share/${id}`, {
    accept: "application/json",
    referer: `https://chatgpt.com/share/${id}`,
    headers: { "oai-language": "en-US" },
  });

  if (api.status === 200) {
    const data = safeJson(api.body);
    if (data) {
      const result = fromPayload(data, url);
      if (result) return { ...result, strategy: "chatgpt:share-api" };
    }
  } else if (api.status === 404) {
    const detail = safeJson(api.body) as { detail?: { code?: string } } | undefined;
    if (detail?.detail?.code === "shared_conversation_deleted") {
      throw new ExtractProblem(
        "not_found",
        "This shared chat was deleted.",
        "Ask whoever shared it to create a new link, or paste the text instead.",
      );
    }
  }

  // Fall back to the rendered page, which embeds the same conversation object.
  const page = await fetchPage(`https://chatgpt.com/share/${id}`);
  if (page.status !== 200) throw statusProblem(page.status, "chatgpt");

  for (const blob of collectEmbeddedJson(page.body)) {
    const [node] = findNodes(
      blob,
      (n) => Array.isArray(n.linear_conversation) || isMapping(n.mapping),
      1,
    );
    if (node) {
      const result = fromPayload(node, url);
      if (result) return { ...result, strategy: "chatgpt:embedded" };
    }
  }

  throw new ExtractProblem(
    "empty",
    "Could not read the messages from that ChatGPT link.",
    "Make sure the link is a public share link and still active.",
  );
}

function safeJson(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function isMapping(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const first = Object.values(value as Record<string, unknown>)[0];
  return Boolean(first && typeof first === "object" && "message" in (first as object));
}

/* -------------------------------------------------------------------------- */
/* Conversation shape                                                         */
/* -------------------------------------------------------------------------- */

interface GptNode {
  id?: string;
  parent?: string | null;
  children?: string[];
  message?: GptMessage | null;
}

interface GptMessage {
  id?: string;
  author?: { role?: string; name?: string | null };
  create_time?: number | null;
  weight?: number;
  recipient?: string;
  content?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

function fromPayload(
  payload: Record<string, unknown>,
  sourceUrl: string,
): Omit<ExtractResult, "strategy"> | null {
  const nodes = orderedNodes(payload);
  if (!nodes.length) return null;

  const messages: ChatMessage[] = [];
  let pendingThinking: string[] = [];
  let model: string | undefined;

  for (const node of nodes) {
    const msg = node.message;
    if (!msg) continue;

    const role = (msg.author?.role ?? "").toLowerCase();
    const meta = msg.metadata ?? {};
    const slug = typeof meta.model_slug === "string" ? meta.model_slug : undefined;
    if (slug && !model) model = slug;

    if (role === "system" || role === "tool") continue;
    if (msg.weight === 0) continue;

    const contentType = String(msg.content?.content_type ?? "text");

    // Reasoning summaries ride along with the answer that follows them.
    if (contentType === "thoughts" || contentType === "reasoning_recap") {
      const thought = readThoughts(msg.content ?? {});
      if (thought) pendingThinking.push(thought);
      continue;
    }

    if (meta.is_visually_hidden_from_conversation === true) continue;
    // Anything addressed to a tool is machinery, not the answer the user read.
    if (role === "assistant" && msg.recipient && msg.recipient !== "all") continue;
    if (contentType === "user_editable_context" || contentType === "system_error") continue;

    const text = cleanText(readContent(msg.content ?? {}), meta);
    if (!text.trim()) continue;

    messages.push({
      id: msg.id ?? node.id ?? uid("m"),
      role: (role === "user" ? "user" : "assistant") as Role,
      content: text,
      thinking: pendingThinking.length ? pendingThinking.join("\n\n") : undefined,
      model: role === "assistant" ? slug : undefined,
      createdAt: msg.create_time ? Math.round(msg.create_time * 1000) : undefined,
    });
    pendingThinking = [];
  }

  if (!messages.length) return null;

  const created = payload.create_time;
  return {
    ok: true,
    title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "",
    source: "chatgpt",
    sourceUrl,
    model,
    originalAt: typeof created === "number" ? Math.round(created * 1000) : undefined,
    messages,
  };
}

/** `linear_conversation` is already in reading order; `mapping` needs a walk. */
function orderedNodes(payload: Record<string, unknown>): GptNode[] {
  const linear = payload.linear_conversation;
  if (Array.isArray(linear) && linear.length) return linear as GptNode[];

  const mapping = payload.mapping as Record<string, GptNode> | undefined;
  if (!mapping || typeof mapping !== "object") return [];

  const current = payload.current_node;
  if (typeof current === "string" && mapping[current]) {
    const chain: GptNode[] = [];
    const seen = new Set<string>();
    let cursor: string | null | undefined = current;
    while (cursor && mapping[cursor] && !seen.has(cursor)) {
      seen.add(cursor);
      chain.push(mapping[cursor]);
      cursor = mapping[cursor].parent;
    }
    return chain.reverse();
  }

  return Object.values(mapping).sort(
    (a, b) => (a.message?.create_time ?? 0) - (b.message?.create_time ?? 0),
  );
}

function readContent(content: Record<string, unknown>): string {
  const type = String(content.content_type ?? "text");

  if (type === "code") {
    const language = typeof content.language === "string" ? content.language : "";
    const text = typeof content.text === "string" ? content.text : "";
    return text ? `\`\`\`${language === "unknown" ? "" : language}\n${text}\n\`\`\`` : "";
  }

  if (type === "execution_output") {
    const text = typeof content.text === "string" ? content.text : "";
    return text ? `\`\`\`\n${text}\n\`\`\`` : "";
  }

  const parts = content.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (typeof p.text === "string") return p.text;
          if (p.content_type === "image_asset_pointer") return "";
          if (p.content_type === "audio_transcription" && typeof p.text === "string") return p.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof content.text === "string") return content.text;
  if (typeof content.result === "string") return content.result;
  return "";
}

function readThoughts(content: Record<string, unknown>): string {
  const thoughts = content.thoughts;
  if (Array.isArray(thoughts)) {
    return thoughts
      .map((t) => {
        const item = t as Record<string, unknown>;
        const summary = typeof item.summary === "string" ? item.summary : "";
        const body = typeof item.content === "string" ? item.content : "";
        return summary && body ? `**${summary}**\n\n${body}` : summary || body;
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof content.content === "string") return content.content;
  return "";
}

/**
 * ChatGPT threads inline citation markers through private-use codepoints. Left
 * alone they render as tofu, so swap the ones we can resolve for real links and
 * drop the rest.
 */
function cleanText(text: string, meta: Record<string, unknown>): string {
  let out = text;

  const refs = meta.content_references;
  if (Array.isArray(refs)) {
    for (const raw of refs) {
      const ref = raw as Record<string, unknown>;
      const matched = typeof ref.matched_text === "string" ? ref.matched_text : "";
      if (!matched || !out.includes(matched)) continue;
      const url = typeof ref.url === "string" ? ref.url : "";
      const title =
        (typeof ref.title === "string" && ref.title) ||
        (typeof ref.alt === "string" && ref.alt) ||
        (url ? new URL(url, "https://x.invalid").hostname.replace(/^www\./, "") : "");
      out = out.split(matched).join(url ? ` ([${title || "source"}](${url}))` : "");
    }
  }

  return out
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/\bcite\s*turn\d+\w*\b/g, "")
    .replace(/\bnavlist\b/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}
