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
  /**
   * Kill switch. Set to false and Losto stops fetching this source entirely,
   * sending readers to the copy-and-paste route instead. Nothing else needs to
   * change, so a source that objects can be switched off in seconds.
   */
  fetchable: boolean;
  /** Shown when a paste-only link is pasted. */
  pasteSteps?: string[];
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
    fetchable: true,
  },
  claude: {
    id: "claude",
    label: "Claude",
    mark: "CL",
    color: "var(--brand-claude)",
    hosts: ["claude.ai"],
    example: "https://claude.ai/share/…",
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the chat in Claude and scroll to the top.",
      "Select the whole conversation and copy it.",
      "Come back here, switch to Paste text, and paste.",
    ],
  },
  perplexity: {
    id: "perplexity",
    label: "Perplexity",
    mark: "PX",
    color: "var(--brand-perplexity)",
    hosts: ["perplexity.ai", "www.perplexity.ai"],
    example: "https://www.perplexity.ai/search/…",
    supported: true,
    // Off: the only way in was an undocumented /rest/thread endpoint, which
    // Perplexity's terms address directly and which refuses every caller anyway.
    fetchable: false,
    pasteSteps: [
      "Open the thread in Perplexity.",
      "Copy the answer with the copy button, or select and copy it.",
      "Come back here, switch to Paste text, and paste.",
    ],
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    mark: "GM",
    color: "var(--brand-gemini)",
    hosts: ["gemini.google.com", "share.gemini.google", "g.co", "aistudio.google.com"],
    example: "https://g.co/gemini/share/…",
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the shared chat in Gemini.",
      "Select and copy the conversation.",
      "Paste it here under Paste text.",
    ],
  },
  grok: {
    id: "grok",
    label: "Grok",
    mark: "GK",
    color: "var(--brand-grok)",
    hosts: ["grok.com", "x.com"],
    example: "https://grok.com/share/…",
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the conversation in Grok.",
      "Select and copy it.",
      "Paste it here under Paste text.",
    ],
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    mark: "DS",
    color: "var(--brand-deepseek)",
    hosts: ["chat.deepseek.com", "deepseek.com"],
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the chat in DeepSeek.",
      "Select and copy it.",
      "Paste it here under Paste text.",
    ],
  },
  copilot: {
    id: "copilot",
    label: "Copilot",
    mark: "CP",
    color: "var(--brand-copilot)",
    hosts: ["copilot.microsoft.com"],
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the conversation in Copilot.",
      "Select and copy it.",
      "Paste it here under Paste text.",
    ],
  },
  mistral: {
    id: "mistral",
    label: "Le Chat",
    mark: "MS",
    color: "var(--brand-mistral)",
    hosts: ["chat.mistral.ai"],
    supported: true,
    fetchable: true,
    pasteSteps: [
      "Open the chat in Le Chat.",
      "Select and copy it.",
      "Paste it here under Paste text.",
    ],
  },
  manual: {
    id: "manual",
    label: "Pasted",
    mark: "TXT",
    color: "var(--brand-manual)",
    hosts: [],
    supported: true,
    fetchable: true,
  },
  unknown: {
    id: "unknown",
    label: "Web",
    mark: "WEB",
    color: "var(--brand-manual)",
    hosts: [],
    supported: true,
    fetchable: true,
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
