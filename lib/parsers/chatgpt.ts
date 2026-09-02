import { appendAssets, kindForUrl, makeAsset } from "../media";
import type { Asset, ChatMessage, ExtractResult, Role } from "../types";
import { uid } from "../utils";
import { collectEmbeddedJson, findNodes, siteIcon } from "./html";
import { decodeReactRouterPage } from "./turbostream";
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

  /*
   * `/share/` is the one conversation path chatgpt.com's robots.txt allows, so
   * that is what Losto reads. The page embeds the whole conversation in its
   * React Router payload; the private backend API would be simpler but is
   * covered by the file's catch-all `Disallow: /`.
   */
  const page = await fetchPage(`https://chatgpt.com/share/${id}`);
  if (page.status !== 200) throw statusProblem(page.status, "chatgpt");

  const routed = decodeReactRouterPage(page.body);
  if (routed) {
    const problem = readServerError(routed);
    if (problem) throw problem;

    const [node] = findNodes(routed, isConversation, 1);
    if (node) {
      const result = fromPayload(node, url);
      if (result) {
        return { ...result, strategy: "chatgpt:share-page", favicon: siteIcon(page.body, page.finalUrl) };
      }
    }
  }

  // Older builds inlined the same object as plain JSON instead.
  for (const blob of collectEmbeddedJson(page.body)) {
    const [node] = findNodes(blob, isConversation, 1);
    if (node) {
      const result = fromPayload(node, url);
      if (result) {
        return { ...result, strategy: "chatgpt:embedded", favicon: siteIcon(page.body, page.finalUrl) };
      }
    }
  }

  throw new ExtractProblem(
    "empty",
    "Could not read the messages from that ChatGPT link.",
    "Make sure the link is a public share link and still active.",
  );
}

function isConversation(node: Record<string, unknown>): boolean {
  return Array.isArray(node.linear_conversation) || isMapping(node.mapping);
}

/** The share page reports a dead or private link inside its loader data. */
function readServerError(routed: unknown): ExtractProblem | null {
  const [response] = findNodes(
    routed,
    (n) => n.type === "error" && ("error" in n || "toastMessage" in n),
    1,
  );
  if (!response) return null;

  const text = [response.error, response.toastMessage]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();

  if (text.includes("deleted") || text.includes("not found")) {
    return new ExtractProblem(
      "not_found",
      "This shared chat no longer exists.",
      "Ask whoever shared it for a new link, or paste the text instead.",
    );
  }
  return new ExtractProblem(
    "private",
    "That chat is not publicly shared.",
    "Open it in ChatGPT, create a share link, then paste that one.",
  );
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

    const contentType = String(msg.content?.content_type ?? "text");

    /*
     * Generated pictures arrive as tool output: role "tool", content_type
     * "multimodal_text", and weight 0 even though the reader sees them. Both of
     * the usual filters would drop them, so they are recognised first and
     * presented as part of the answer.
     */
    const isPictureTurn = role === "tool" && hasImageParts(msg.content);

    if (!isPictureTurn) {
      if (role === "system" || role === "tool") continue;
      if (msg.weight === 0) continue;
    }

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

    const { text: rawText, media } = readContent(msg.content ?? {});
    const text = cleanText(rawText, meta);
    const raw = [...media, ...readAttachments(meta)];
    const assets = toAssets(raw);

    // A message can be nothing but a picture, so media alone is worth keeping.
    if (!text.trim() && !assets.length) continue;

    messages.push({
      id: msg.id ?? node.id ?? uid("m"),
      role: (role === "user" ? "user" : "assistant") as Role,
      content: appendAssets(text, assets),
      thinking: pendingThinking.length ? pendingThinking.join("\n\n") : undefined,
      model: role === "assistant" ? slug : undefined,
      createdAt: msg.create_time ? Math.round(msg.create_time * 1000) : undefined,
      assets: assets.length ? assets : undefined,
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

/* -------------------------------------------------------------------------- */
/* Asset pointers                                                             */
/* -------------------------------------------------------------------------- */


/**
 * Turns the media in a message into assets.
 *
 * A picture the payload gives a real URL for is kept. A `file-service://`
 * pointer is not: the only endpoints that would resolve one are OpenAI's
 * internal file APIs, which are undocumented, sit under chatgpt.com's catch-all
 * `Disallow: /`, and refuse an unauthenticated caller anyway. Losto marks the
 * spot instead, and the reader can drop the picture in from their own device.
 */
function toAssets(raw: RawMedia[]): Asset[] {
  const out: Asset[] = [];

  for (const item of raw) {
    if (item.url) {
      const asset = makeAsset({
        url: item.url,
        kind: kindForUrl(item.url, item.mime) ?? "image",
        alt: item.alt,
        mime: item.mime,
        width: item.width,
        height: item.height,
        prompt: item.prompt,
      });
      if (asset) out.push(asset);
      continue;
    }

    const fileId = item.pointer?.match(POINTER_RE)?.[1];
    if (!fileId) continue;

    const asset = makeAsset({
      url: `chatgpt-file://${fileId}`,
      kind: "image",
      alt: item.alt,
      width: item.width,
      height: item.height,
      prompt: item.prompt,
      unavailable: true,
      unavailableReason:
        "ChatGPT does not include generated images in a public share link - they only load for someone signed in to the account. Add the file from this device to keep it.",
    });
    if (asset) out.push(asset);
  }

  return out;
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

/** A picture found in the payload, before we know where its bytes live. */
export interface RawMedia {
  pointer?: string;
  url?: string;
  width?: number;
  height?: number;
  prompt?: string;
  alt?: string;
  mime?: string;
}

function readContent(content: Record<string, unknown>): { text: string; media: RawMedia[] } {
  const type = String(content.content_type ?? "text");
  const media: RawMedia[] = [];

  if (type === "code") {
    const language = typeof content.language === "string" ? content.language : "";
    const text = typeof content.text === "string" ? content.text : "";
    return {
      text: text ? `\`\`\`${language === "unknown" ? "" : language}\n${text}\n\`\`\`` : "",
      media,
    };
  }

  if (type === "execution_output") {
    const text = typeof content.text === "string" ? content.text : "";
    return { text: text ? `\`\`\`\n${text}\n\`\`\`` : "", media };
  }

  const parts = content.parts;
  if (Array.isArray(parts)) {
    const text = parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const p = part as Record<string, unknown>;
          if (p.content_type === "image_asset_pointer") {
            const found = readImagePart(p);
            if (found) media.push(found);
            return "";
          }
          if (typeof p.text === "string") return p.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
    return { text, media };
  }

  if (typeof content.text === "string") return { text: content.text, media };
  if (typeof content.result === "string") return { text: content.result, media };
  return { text: "", media };
}

/**
 * Pointers use `sediment://file_…` on current builds and `file-service://file-…`
 * on older ones. Both carry the file id in the same place.
 */
const POINTER_RE = /^(?:sediment|file-service):\/\/([^?#]+)/;

/** True when a message carries at least one picture part. */
function hasImageParts(content: Record<string, unknown> | undefined): boolean {
  const parts = content?.parts;
  return (
    Array.isArray(parts) &&
    parts.some(
      (p) =>
        p && typeof p === "object" && (p as Record<string, unknown>).content_type === "image_asset_pointer",
    )
  );
}

/** Pulls the address and the DALL·E prompt out of an image part. */
function readImagePart(part: Record<string, unknown>): RawMedia | null {
  const pointer = typeof part.asset_pointer === "string" ? part.asset_pointer : "";
  const meta = (part.metadata ?? {}) as Record<string, unknown>;
  const dalle = (meta.dalle ?? {}) as Record<string, unknown>;

  const direct =
    firstUrl(part.download_url) ??
    firstUrl(part.url) ??
    firstUrl(dalle.url) ??
    (pointer.startsWith("http") ? pointer : undefined);

  const found: RawMedia = {
    pointer: pointer && !pointer.startsWith("http") ? pointer : undefined,
    url: direct,
    width: numberOr(part.width),
    height: numberOr(part.height),
    prompt: typeof dalle.prompt === "string" ? dalle.prompt : undefined,
  };
  found.alt = found.prompt ? truncatePrompt(found.prompt) : "Image from the chat";
  return found.pointer || found.url ? found : null;
}

function firstUrl(value: unknown): string | undefined {
  return typeof value === "string" && /^https?:\/\//.test(value) ? value : undefined;
}

function numberOr(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function truncatePrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120).replace(/\s+\S*$/, "")}…` : clean;
}

/** User-uploaded files ride along in message metadata rather than the parts. */
function readAttachments(meta: Record<string, unknown>): RawMedia[] {
  const list = meta.attachments;
  if (!Array.isArray(list)) return [];
  const out: RawMedia[] = [];
  for (const raw of list) {
    const item = raw as Record<string, unknown>;
    const mime = typeof item.mime_type === "string" ? item.mime_type : undefined;
    const name = typeof item.name === "string" ? item.name : undefined;
    const id = typeof item.id === "string" ? item.id : undefined;
    const url = firstUrl(item.url) ?? firstUrl(item.download_url);
    if (!url && !id) continue;
    // Only media is worth downloading; documents stay as plain references.
    if (mime && !/^(image|video|audio)\//.test(mime)) continue;
    if (!mime && !url) continue;
    out.push({
      pointer: url ? undefined : id,
      url,
      mime,
      alt: name ?? "Attached file",
      width: numberOr(item.width),
      height: numberOr(item.height),
    });
  }
  return out;
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
/**
 * Whether a content reference is safe to substitute across the whole message.
 *
 * The replacement is a blind split/join, so a `matched_text` that appears
 * everywhere would be rewritten everywhere. ChatGPT emits `sources_footnote`
 * entries whose matched_text is a single space and whose url is empty: taken at
 * face value that deletes every space in the answer, which is exactly what it
 * did until this check existed.
 *
 * A real marker is wrapped in private-use characters. Anything else is only
 * touched when it carries a url and is long enough not to be ordinary prose -
 * and plain text is never deleted, only ever linked.
 */
function isCitationMarker(matched: string, url: string): boolean {
  if (!matched.trim()) return false;
  if (/[-]/.test(matched)) return true;
  return Boolean(url) && matched.length >= 8;
}

function cleanText(text: string, meta: Record<string, unknown>): string {
  let out = text;

  const refs = meta.content_references;
  if (Array.isArray(refs)) {
    for (const raw of refs) {
      const ref = raw as Record<string, unknown>;
      const matched = typeof ref.matched_text === "string" ? ref.matched_text : "";
      const url = typeof ref.url === "string" ? ref.url : "";
      if (!isCitationMarker(matched, url) || !out.includes(matched)) continue;
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
