import { appendAssets, dedupeAssets, kindForUrl, makeAsset } from "../media";
import type { Asset, ChatMessage, ExtractResult } from "../types";
import { uid } from "../utils";
import { collectEmbeddedJson, findNodes, siteIcon } from "./html";
import { decodeReactRouterPage } from "./turbostream";
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

  /*
   * claude.ai's robots.txt allows `/share/` but disallows `/api/*`, so the
   * snapshot endpoint is off limits and the shared page is read instead.
   */
  const page = await fetchPage(`https://claude.ai/share/${id}`);
  if (page.status === 404) {
    throw new ExtractProblem(
      "not_found",
      "That shared Claude chat no longer exists.",
      "Ask for a fresh share link, or paste the text instead.",
    );
  }
  if (page.status !== 200) throw statusProblem(page.status, "claude");

  for (const blob of collectEmbeddedJson(page.body)) {
    const [node] = findNodes(blob, (n) => Array.isArray(n.chat_messages), 1);
    if (node) {
      const built = fromSnapshot(node, url);
      if (built) return { ...built, strategy: "claude:share-page", favicon: siteIcon(page.body, page.finalUrl) };
    }
  }

  const routed = decodeReactRouterPage(page.body);
  if (routed) {
    const [node] = findNodes(routed, (n) => Array.isArray(n.chat_messages), 1);
    if (node) {
      const built = fromSnapshot(node, url);
      if (built) return { ...built, strategy: "claude:share-stream", favicon: siteIcon(page.body, page.finalUrl) };
    }
  }

  throw new ExtractProblem(
    "empty",
    "Could not read the messages from that Claude link.",
    "Claude only exposes chats that were explicitly shared publicly. If it is shared and this still fails, paste the text instead.",
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

    const { text, thinking, assets } = readBlocks(m);
    const body = text.trim() || String(m.text ?? "").trim();
    if (!body && !thinking && !assets.length) continue;

    messages.push({
      id: String(m.uuid ?? m.id ?? uid("m")),
      role,
      content: appendAssets(body, assets),
      thinking: thinking || undefined,
      createdAt: toTime(m.created_at),
      assets: assets.length ? assets : undefined,
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

function readBlocks(message: Record<string, unknown>): {
  text: string;
  thinking: string;
  assets: Asset[];
} {
  const assets = readFiles(message);
  const content = message.content;
  if (!Array.isArray(content)) {
    return {
      text: typeof message.text === "string" ? message.text : "",
      thinking: "",
      assets,
    };
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
      case "image": {
        const asset = readImageBlock(entry as Record<string, unknown>);
        if (asset) assets.push(asset);
        break;
      }
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

  return { text: parts.join("\n\n"), thinking: thoughts.join("\n\n"), assets: dedupeAssets(assets) };
}

/** Inline image blocks arrive either as a link or as base64 bytes. */
function readImageBlock(block: Record<string, unknown>): Asset | null {
  const source = (block.source ?? {}) as Record<string, unknown>;
  const mime = typeof source.media_type === "string" ? source.media_type : "image/png";
  const alt = typeof block.alt === "string" ? block.alt : "Image from the chat";

  if (typeof source.url === "string" && /^https?:\/\//.test(source.url)) {
    return makeAsset({ url: source.url, kind: "image", mime, alt });
  }
  if (source.type === "base64" && typeof source.data === "string" && source.data.length) {
    // A data URL is downloadable by the browser without going through the proxy.
    return makeAsset({ url: `data:${mime};base64,${source.data}`, kind: "image", mime, alt });
  }
  return null;
}

/** Uploads attached to a turn sit alongside the content blocks. */
function readFiles(message: Record<string, unknown>): Asset[] {
  const out: Asset[] = [];
  for (const key of ["files", "attachments", "files_v2"]) {
    const list = message[key];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const file = raw as Record<string, unknown>;
      const href =
        pickString(file.preview_url) ??
        pickString(file.file_url) ??
        pickString(file.url) ??
        pickString(file.thumbnail_url);
      if (!href) continue;
      const url = href.startsWith("http") ? href : `https://claude.ai${href}`;
      const name = pickString(file.file_name) ?? pickString(file.name) ?? "Attached file";
      const asset = makeAsset({ url, alt: name, kind: kindForUrl(url) ?? "image" });
      if (asset) out.push(asset);
    }
  }
  return out;
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function toTime(value: unknown): number | undefined {
  if (typeof value === "number") return value > 1e12 ? value : value * 1000;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}
