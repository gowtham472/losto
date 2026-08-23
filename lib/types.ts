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
