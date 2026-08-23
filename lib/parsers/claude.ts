import type { ChatMessage, ExtractResult } from "../types";
import { uid } from "../utils";
import { collectEmbeddedJson, findNodes } from "./html";
import { ExtractProblem, fetchPage, statusProblem } from "./http";

function snapshotId(url: string): string | null {
  const m = url.match(/\/(?:share|chat)\/([0-9a-fA-F-]{16,}|[A-Za-z0-9_-]{8,})/);
  return m ? m[1] : null;
}

export async function parseClaude(url: string): Promise<ExtractResult> {
  const id = snapshotId(url);
  if (!id) {
    throw new ExtractProblem(
      "bad_url",
      "That does not look like a Claude share link.",
      "It should look like https://claude.ai/share/xxxxxxxx-xxxx-…",
    );
  }

  const api = await fetchPage(`https://claude.ai/api/chat_snapshots/${id}`, {
    accept: "application/json",
    referer: `https://claude.ai/share/${id}`,
  });

  if (api.status === 200) {
    try {
      const data = JSON.parse(api.body) as Record<string, unknown>;
      const built = fromSnapshot(data, url);
      if (built) return { ...built, strategy: "claude:snapshot-api" };
    } catch {
      /* fall through to the page */
    }
  } else if (api.status === 404) {
    throw new ExtractProblem(
      "not_found",
      "That shared Claude chat no longer exists.",
      "Ask for a fresh share link, or paste the text instead.",
    );
  }

  const page = await fetchPage(`https://claude.ai/share/${id}`);
  if (page.status !== 200) throw statusProblem(page.status, "claude");

  for (const blob of collectEmbeddedJson(page.body)) {
    const [node] = findNodes(blob, (n) => Array.isArray(n.chat_messages), 1);
    if (node) {
      const built = fromSnapshot(node, url);
      if (built) return { ...built, strategy: "claude:embedded" };
    }
  }

  throw new ExtractProblem(
    "empty",
    "Could not read the messages from that Claude link.",
    "Claude only exposes chats that were explicitly shared publicly.",
  );
}

interface ClaudeBlock {
  type?: string;
  text?: string;
  thinking?: string;
  content?: unknown;
  language?: string;
  title?: string;
}

function fromSnapshot(
  data: Record<string, unknown>,
  sourceUrl: string,
): Omit<ExtractResult, "strategy"> | null {
  const raw = data.chat_messages;
  if (!Array.isArray(raw) || !raw.length) return null;

  const messages: ChatMessage[] = [];
  for (const item of raw) {
    const m = item as Record<string, unknown>;
    const sender = String(m.sender ?? m.role ?? "").toLowerCase();
    const role = sender === "human" || sender === "user" ? "user" : "assistant";

    const { text, thinking } = readBlocks(m);
    const body = text.trim() || String(m.text ?? "").trim();
    if (!body && !thinking) continue;

    messages.push({
      id: String(m.uuid ?? m.id ?? uid("m")),
      role,
      content: body,
      thinking: thinking || undefined,
      createdAt: toTime(m.created_at),
    });
  }

  if (!messages.length) return null;

  const model = typeof data.model === "string" ? data.model : undefined;
  return {
    ok: true,
    title: typeof data.name === "string" ? data.name.trim() : "",
    source: "claude",
    sourceUrl,
    model,
    originalAt: toTime(data.created_at),
    messages,
  };
}

function readBlocks(message: Record<string, unknown>): { text: string; thinking: string } {
  const content = message.content;
  if (!Array.isArray(content)) {
    return { text: typeof message.text === "string" ? message.text : "", thinking: "" };
  }

  const parts: string[] = [];
  const thoughts: string[] = [];

  for (const entry of content) {
    const block = entry as ClaudeBlock;
    switch (block.type) {
      case "text":
        if (block.text) parts.push(block.text);
        break;
      case "thinking":
        if (block.thinking) thoughts.push(block.thinking);
        break;
      // Artifacts arrive as tool calls; keep the document, drop the plumbing.
      case "tool_use": {
        const input = (entry as Record<string, unknown>).input as
          | Record<string, unknown>
          | undefined;
        const artifact = typeof input?.content === "string" ? input.content : "";
        if (artifact) {
          const lang = typeof input?.language === "string" ? input.language : "";
          const title = typeof input?.title === "string" ? input.title : "";
          parts.push(
            lang && lang !== "text/markdown"
              ? `${title ? `**${title}**\n\n` : ""}\`\`\`${lang}\n${artifact}\n\`\`\``
              : `${title ? `**${title}**\n\n` : ""}${artifact}`,
          );
        }
        break;
      }
      default:
        if (typeof block.text === "string" && block.text) parts.push(block.text);
    }
  }

  return { text: parts.join("\n\n"), thinking: thoughts.join("\n\n") };
}

function toTime(value: unknown): number | undefined {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}
