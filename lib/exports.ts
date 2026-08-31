/**
 * Reads the export files the assistants themselves hand out.
 *
 * This is the import route with nothing to argue about. The reader asks the
 * provider for their own data, the provider gives it to them, and Losto reads
 * the file off the device. No fetching, no share link, no endpoint, no terms to
 * weigh - and it brings across a whole history rather than one conversation at
 * a time.
 *
 * Deliberately free of any parser import: this runs in the browser, so an
 * exported history is never uploaded anywhere, and it works with no connection.
 *
 * - ChatGPT: Settings → Data controls → Export data → `conversations.json`
 * - Claude:  Settings → Privacy → Export data → `conversations.json`
 */
import type { ChatMessage, ExtractResult, Role, SourceId } from "./types";
import { countWords, deriveTitle, uid } from "./utils";

export interface ExportSummary {
  source: SourceId;
  chats: ExtractResult[];
  /** Conversations in the file that held nothing readable. */
  skipped: number;
}

export class ExportProblem extends Error {}

/* -------------------------------------------------------------------------- */

export function readExport(text: string): ExportSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExportProblem(
      "That file is not JSON. Unzip the export first and pick conversations.json from inside it.",
    );
  }

  const list = Array.isArray(parsed) ? parsed : [parsed];
  const items = list.filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === "object");
  if (!items.length) throw new ExportProblem("That file has no conversations in it.");

  const source = detectExport(items[0]);
  if (!source) {
    throw new ExportProblem(
      "Losto does not recognise that export. It reads conversations.json from ChatGPT or Claude.",
    );
  }

  const chats: ExtractResult[] = [];
  let skipped = 0;
  for (const item of items) {
    const built = source === "chatgpt" ? fromChatGpt(item) : fromClaude(item);
    if (built) chats.push(built);
    else skipped += 1;
  }

  if (!chats.length) throw new ExportProblem("Every conversation in that file was empty.");
  return { source, chats, skipped };
}

function detectExport(sample: Record<string, unknown>): SourceId | null {
  if (sample.mapping || sample.linear_conversation) return "chatgpt";
  if (Array.isArray(sample.chat_messages)) return "claude";
  return null;
}

/* -------------------------------------------------------------------------- */
/* ChatGPT                                                                    */
/* -------------------------------------------------------------------------- */

interface GptNode {
  parent?: string | null;
  message?: {
    author?: { role?: string };
    create_time?: number;
    content?: { content_type?: string; parts?: unknown[] };
    metadata?: Record<string, unknown>;
  } | null;
}

function fromChatGpt(conversation: Record<string, unknown>): ExtractResult | null {
  const messages: ChatMessage[] = [];
  let model: string | undefined;

  for (const node of chainOf(conversation)) {
    const message = node.message;
    if (!message) continue;

    const role = normaliseRole(message.author?.role);
    if (role !== "user" && role !== "assistant") continue;

    const meta = message.metadata ?? {};
    if (!model && typeof meta.model_slug === "string") model = meta.model_slug;
    // A hidden turn is scaffolding the reader never saw in the app either.
    if (meta.is_visually_hidden_from_conversation) continue;

    const text = partsToText(message.content?.parts);
    if (!text.trim()) continue;

    messages.push({
      id: uid("m"),
      role,
      content: text,
      model: role === "assistant" ? model : undefined,
      createdAt: message.create_time ? Math.round(message.create_time * 1000) : undefined,
    });
  }

  if (!messages.length) return null;

  const title = String(conversation.title ?? "").trim() || deriveTitle(messages);
  const created = typeof conversation.create_time === "number" ? conversation.create_time : undefined;

  return {
    ok: true,
    title,
    source: "chatgpt",
    // An export has no public address, and inventing one would imply the
    // conversation is shared when it is not.
    sourceUrl: "",
    model,
    originalAt: created ? Math.round(created * 1000) : undefined,
    messages,
    strategy: "chatgpt:export",
  };
}

/** The path from the newest node back to the root - the branch actually kept. */
function chainOf(conversation: Record<string, unknown>): GptNode[] {
  const linear = conversation.linear_conversation;
  if (Array.isArray(linear) && linear.length) return linear as GptNode[];

  const mapping = conversation.mapping as Record<string, GptNode> | undefined;
  if (!mapping || typeof mapping !== "object") return [];

  const current = conversation.current_node;
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

function partsToText(parts: unknown[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      // Non-text parts are images and tool payloads; the bytes live elsewhere
      // in the export, so there is nothing to render from the JSON alone.
      if (part && typeof part === "object") {
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/* -------------------------------------------------------------------------- */
/* Claude                                                                     */
/* -------------------------------------------------------------------------- */

interface ClaudeMessage {
  sender?: string;
  text?: string;
  created_at?: string;
  content?: { type?: string; text?: string }[];
}

function fromClaude(conversation: Record<string, unknown>): ExtractResult | null {
  const raw = conversation.chat_messages;
  if (!Array.isArray(raw)) return null;

  const messages: ChatMessage[] = [];
  for (const entry of raw as ClaudeMessage[]) {
    const role = normaliseRole(entry?.sender);
    if (role !== "user" && role !== "assistant") continue;

    // Newer exports put the words in a content array and leave `text` empty.
    const blocks = Array.isArray(entry.content)
      ? entry.content
          .filter((b) => !b.type || b.type === "text")
          .map((b) => b.text ?? "")
          .filter(Boolean)
          .join("\n\n")
      : "";
    const text = (blocks || entry.text || "").trim();
    if (!text) continue;

    messages.push({
      id: uid("m"),
      role,
      content: text,
      createdAt: entry.created_at ? Date.parse(entry.created_at) || undefined : undefined,
    });
  }

  if (!messages.length) return null;

  const title = String(conversation.name ?? "").trim() || deriveTitle(messages);
  const created = typeof conversation.created_at === "string" ? Date.parse(conversation.created_at) : NaN;

  return {
    ok: true,
    title,
    source: "claude",
    sourceUrl: "",
    originalAt: Number.isFinite(created) ? created : undefined,
    messages,
    strategy: "claude:export",
  };
}

/* -------------------------------------------------------------------------- */

function normaliseRole(value: unknown): Role | null {
  const role = String(value ?? "").toLowerCase();
  if (role === "user" || role === "human") return "user";
  if (role === "assistant") return "assistant";
  if (role === "system" || role === "tool") return role;
  return null;
}

/** A one-line description of what a file holds, before anything is saved. */
export function describeExport(summary: ExportSummary): string {
  const words = summary.chats.reduce(
    (total, chat) => total + chat.messages.reduce((n, m) => n + countWords(m.content), 0),
    0,
  );
  const count = summary.chats.length;
  return `${count} ${count === 1 ? "conversation" : "conversations"} · ${words.toLocaleString()} words${
    summary.skipped ? ` · ${summary.skipped} empty and skipped` : ""
  }`;
}
