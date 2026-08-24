export type SourceId =
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "gemini"
  | "grok"
  | "deepseek"
  | "copilot"
  | "mistral"
  | "manual"
  | "unknown";

export type Role = "user" | "assistant" | "system" | "tool";

export type AssetKind = "image" | "video" | "audio" | "embed";

/**
 * A picture, clip or embedded player found in a conversation. Media URLs from
 * the assistants are signed and expire within hours, so the bytes are copied
 * into IndexedDB at import time and the markdown points at `losto-asset:<id>`.
 */
export interface Asset {
  id: string;
  kind: AssetKind;
  /** Canonical remote address: the media file, or the watch page for an embed. */
  url: string;
  /** What to actually download - an embed stores its poster frame instead. */
  fetchUrl?: string;
  mime?: string;
  width?: number;
  height?: number;
  alt?: string;
  title?: string;
  /** youtube, vimeo, loom … for embeds. */
  provider?: string;
  /** The generation prompt, when the source records one. */
  prompt?: string;
  /** Set when the source will not serve the bytes to anyone but a signed-in user. */
  unavailable?: boolean;
  /** Why it is unavailable, shown in place of the picture. */
  unavailableReason?: string;
  /** Filled in once the blob is stored locally. */
  bytes?: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  /** Markdown. Rendered verbatim so the answer looks like it did in the original chat. */
  content: string;
  /** Collapsed reasoning trace, when the source exposes one. */
  thinking?: string;
  model?: string;
  createdAt?: number;
  /** Citation links surfaced by search-grounded sources like Perplexity. */
  citations?: { title?: string; url: string }[];
  /** Media referenced by this message's markdown, keyed by `losto-asset:<id>`. */
  assets?: Asset[];
}

/** Everything the library list needs, without pulling message bodies into memory. */
export interface ChatMeta {
  id: string;
  title: string;
  source: SourceId;
  sourceUrl: string;
  model?: string;
  collectionId: string | null;
  tags: string[];
  /** When it landed in Losto. */
  savedAt: number;
  /** When the conversation happened, if the source told us. */
  originalAt?: number;
  updatedAt: number;
  messageCount: number;
  wordCount: number;
  readMinutes: number;
  favorite: boolean;
  archived: boolean;
  /** 0..1 - how far through the reader the user got. */
  progress: number;
  lastOpenedAt?: number;
  excerpt: string;
  note?: string;
  /** Message ids the user marked as important. */
  pinned: string[];
  /** Asset ids this chat references, so deletes can collect orphaned blobs. */
  assetIds?: string[];
  /** Id of the first image, used as the library card thumbnail. */
  coverAssetId?: string;
  /** Stored favicon of the source site, shown in place of the monogram. */
  faviconAssetId?: string;
  /** Total bytes of media stored for this chat. */
  mediaBytes?: number;
  /** Media the source refused to hand over, surfaced in the reader. */
  missingMedia?: number;
}

export interface ChatBody {
  id: string;
  messages: ChatMessage[];
}

export type Chat = ChatMeta & { messages: ChatMessage[] };

export interface Collection {
  id: string;
  name: string;
  /** One of the COLLECTION_COLORS keys. */
  color: string;
  emoji: string;
  createdAt: number;
  order: number;
}

export interface Settings {
  theme: "light" | "dark" | "system";
  readerSize: number;
  readerTypeface: "sans" | "serif" | "mono";
  readerLayout: "chat" | "document";
  showThinking: boolean;
  density: "comfortable" | "compact";
  sort: SortKey;
  view: "grid" | "list";
  /** Which media to copy onto the device at import time. */
  media: "all" | "images" | "none";
  /** Skip any single file larger than this, in megabytes. */
  maxAssetMB: number;
}

export type SortKey = "recent" | "opened" | "title" | "longest" | "oldest";

/** Shape returned by /api/extract. */
export interface ExtractResult {
  ok: boolean;
  title: string;
  source: SourceId;
  sourceUrl: string;
  model?: string;
  originalAt?: number;
  messages: ChatMessage[];
  /** Which strategy produced the result - surfaced in the UI for transparency. */
  strategy: string;
  warning?: string;
  /** Every asset across all messages, deduplicated, for the download step. */
  assets?: Asset[];
  /** The source site's own icon, stored so it shows offline. */
  favicon?: Asset;
}

export interface ExtractError {
  ok: false;
  error: string;
  code:
    | "bad_url"
    | "unsupported"
    | "not_found"
    | "private"
    | "blocked"
    | "empty"
    | "network"
    | "unknown";
  source: SourceId;
  hint?: string;
}

export interface BackupFile {
  app: "losto";
  version: number;
  exportedAt: number;
  collections: Collection[];
  chats: (ChatMeta & { messages: ChatMessage[] })[];
}
