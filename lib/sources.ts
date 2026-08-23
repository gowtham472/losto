import type { SourceId } from "./types";

export interface SourceInfo {
  id: SourceId;
  label: string;
  /** Short mark drawn in the avatar tile. */
  mark: string;
  color: string;
  hosts: string[];
  /** Example share link shown as a placeholder / hint. */
  example?: string;
  supported: boolean;
}

export const SOURCES: Record<SourceId, SourceInfo> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    mark: "GPT",
    color: "var(--brand-chatgpt)",
    hosts: ["chatgpt.com", "chat.openai.com"],
    example: "https://chatgpt.com/share/…",
    supported: true,
  },
  claude: {
    id: "claude",
    label: "Claude",
    mark: "CL",
    color: "var(--brand-claude)",
    hosts: ["claude.ai"],
    example: "https://claude.ai/share/…",
    supported: true,
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    mark: "PX",
    color: "var(--brand-perplexity)",
    hosts: ["perplexity.ai", "www.perplexity.ai"],
    example: "https://www.perplexity.ai/search/…",
    supported: true,
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    mark: "GM",
    color: "var(--brand-gemini)",
    hosts: ["gemini.google.com", "g.co", "aistudio.google.com"],
    example: "https://g.co/gemini/share/…",
    supported: true,
  },
  grok: {
    id: "grok",
    label: "Grok",
    mark: "GK",
    color: "var(--brand-grok)",
    hosts: ["grok.com", "x.com"],
    example: "https://grok.com/share/…",
    supported: true,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    mark: "DS",
    color: "var(--brand-deepseek)",
    hosts: ["chat.deepseek.com", "deepseek.com"],
    supported: true,
  },
  copilot: {
    id: "copilot",
    label: "Copilot",
    mark: "CP",
    color: "var(--brand-copilot)",
    hosts: ["copilot.microsoft.com"],
    supported: true,
  },
  mistral: {
    id: "mistral",
    label: "Le Chat",
    mark: "MS",
    color: "var(--brand-mistral)",
    hosts: ["chat.mistral.ai"],
    supported: true,
  },
  manual: {
    id: "manual",
    label: "Pasted",
    mark: "TXT",
    color: "var(--brand-manual)",
    hosts: [],
    supported: true,
  },
  unknown: {
    id: "unknown",
    label: "Web",
    mark: "WEB",
    color: "var(--brand-manual)",
    hosts: [],
    supported: true,
  },
};

/** Order used for filter chips. */
export const SOURCE_ORDER: SourceId[] = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
  "grok",
  "deepseek",
  "copilot",
  "mistral",
  "manual",
  "unknown",
];

export function detectSource(url: string): SourceId {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
  for (const id of SOURCE_ORDER) {
    const info = SOURCES[id];
    if (info.hosts.some((h) => host === h.replace(/^www\./, "") || host.endsWith(`.${h}`))) {
      return id;
    }
  }
  return "unknown";
}

export function sourceInfo(id: SourceId | undefined): SourceInfo {
  return SOURCES[id ?? "unknown"] ?? SOURCES.unknown;
}

export const COLLECTION_COLORS: Record<string, string> = {
  blue: "var(--accent)",
  green: "var(--green)",
  orange: "var(--orange)",
  red: "var(--red)",
  violet: "var(--violet)",
  slate: "var(--ink-2)",
};

export const COLLECTION_COLOR_KEYS = Object.keys(COLLECTION_COLORS);

/** Suggested starter subjects - offered on the empty state, never forced. */
export const STARTER_COLLECTIONS: { name: string; emoji: string; color: string }[] = [
  { name: "Mathematics", emoji: "∑", color: "blue" },
  { name: "Physics", emoji: "⚛", color: "violet" },
  { name: "Chemistry", emoji: "⚗", color: "green" },
  { name: "Computer Science", emoji: "⌘", color: "orange" },
  { name: "Question Bank", emoji: "★", color: "red" },
];
