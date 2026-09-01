/**
 * Marks that ship with the app.
 *
 * Everything else still shows the icon fetched from the site itself, which
 * stays right through a rebrand and needs nothing bundled. These few are here
 * because the fetch cannot be relied on: Gemini serves no favicon at any
 * well-known path, ChatGPT refuses an identified request for its own, and a
 * mark that is already on the device shows on the first frame and offline.
 *
 * They are the providers' trademarks, used to say where a saved item came from
 * and nothing else. See the note in THIRD-PARTY-NOTICES.md.
 */
import type { SourceId } from "./types";

export interface Logo {
  src: string;
  /** Alt text is empty by design - the label beside it already names the source. */
  width: number;
  height: number;
}

const SOURCE_LOGOS: Partial<Record<SourceId, Logo>> = {
  chatgpt: { src: "/icons/chatgpt-icon.webp", width: 512, height: 512 },
  claude: { src: "/icons/claude-ai-icon.webp", width: 512, height: 512 },
  gemini: { src: "/icons/google-gemini-icon.webp", width: 512, height: 512 },
  perplexity: { src: "/icons/perplexity-ai-icon.webp", width: 512, height: 512 },
  grok: { src: "/icons/grok-icon.webp", width: 512, height: 512 },
  deepseek: { src: "/icons/deepseek-logo-icon.webp", width: 512, height: 512 },
};

/** Sites worth a bundled mark even though they are not an assistant. */
const HOST_LOGOS: [RegExp, Logo][] = [
  [
    /(^|\.)(wikipedia|wikimedia|wiktionary|wikibooks)\.org$/i,
    { src: "/icons/wikipedia-icon.png", width: 512, height: 512 },
  ],
];

/**
 * The mark to show for a saved item, or null to fall back to the icon fetched
 * from the site and then to the monogram.
 */
export function bundledLogo(source: SourceId, sourceUrl?: string): Logo | null {
  const bySource = SOURCE_LOGOS[source];
  if (bySource) return bySource;

  if (!sourceUrl) return null;
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  return HOST_LOGOS.find(([pattern]) => pattern.test(host))?.[1] ?? null;
}
