import TurndownService from "turndown";
import { embedInfo, makeAsset } from "../media";
import type { Asset } from "../types";

/* -------------------------------------------------------------------------- */
/* Embedded JSON discovery                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Reads one balanced JSON value starting at `start` (which must point at `{`
 * or `[`), respecting strings and escapes. Returns the raw slice or null.
 */
export function readBalanced(text: string, start: number): string | null {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Every JSON payload a page embeds: `<script type="application/json">` blocks,
 * `__NEXT_DATA__`, and `window.X = {...}` / `self.X = [...]` assignments.
 */
export function collectEmbeddedJson(html: string, limit = 40): unknown[] {
  const found: unknown[] = [];

  const scriptRe =
    /<script\b[^>]*type=["'](?:application\/json|application\/ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = scriptRe.exec(html); m && found.length < limit; m = scriptRe.exec(html)) {
    const parsed = safeParse(decodeEntities(m[1].trim()));
    if (parsed && typeof parsed === "object") found.push(parsed);
  }

  const assignRe = /(?:window|self|globalThis)\.__[A-Z0-9_]+__\s*=\s*(?!\?)/g;
  for (let m = assignRe.exec(html); m && found.length < limit; m = assignRe.exec(html)) {
    const start = m.index + m[0].length;
    const ch = html[start];
    if (ch !== "{" && ch !== "[") continue;
    const raw = readBalanced(html, start);
    if (!raw) continue;
    const parsed = safeParse(raw);
    if (parsed && typeof parsed === "object") found.push(parsed);
  }

  return found;
}

/**
 * Walks a parsed structure breadth-first and returns every node the predicate
 * accepts. Cheaper and far more robust than pattern-matching the raw HTML.
 */
export function findNodes(
  root: unknown,
  match: (node: Record<string, unknown>) => boolean,
  limit = 8,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  let steps = 0;

  while (queue.length && out.length < limit && steps < 300_000) {
    steps++;
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }

    const record = node as Record<string, unknown>;
    if (match(record)) out.push(record);
    for (const value of Object.values(record)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return out;
}

/** Some payloads nest a JSON document inside a string field. */
export function parseMaybeJsonString(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  return safeParse(trimmed) ?? value;
}

/* -------------------------------------------------------------------------- */
/* Text helpers                                                               */
/* -------------------------------------------------------------------------- */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
  "#47": "/",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name: string) => {
    const key = name.toLowerCase();
    if (ENTITIES[name] ?? ENTITIES[key]) return ENTITIES[name] ?? ENTITIES[key];
    if (name.startsWith("#x") || name.startsWith("#X")) {
      const code = Number.parseInt(name.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (name.startsWith("#")) {
      const code = Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return whole;
  });
}

/**
 * Finds the site's own icon so a saved item can carry the publisher's mark.
 *
 * Only the site's own declared icon is used — never a third-party favicon
 * service, which would hand someone else a log of everything a reader saves.
 * The largest declared size wins, since these are stored once and scaled down.
 */
export function findFavicon(html: string, baseUrl: string): string | undefined {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return undefined;
  }

  const candidates: { href: string; score: number }[] = [];
  const linkRe = /<link\b[^>]*>/gi;

  for (let m = linkRe.exec(html); m; m = linkRe.exec(html)) {
    const tag = m[0];
    const rel = attrOf(tag, "rel")?.toLowerCase() ?? "";
    if (!/\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)\b/.test(rel)) {
      continue;
    }
    const href = attrOf(tag, "href");
    if (!href) continue;

    // Prefer a big, square, raster icon: they render well at any tile size.
    const sizes = attrOf(tag, "sizes") ?? "";
    const largest = Math.max(
      0,
      ...(sizes.match(/\d+/g) ?? []).map((n) => Number.parseInt(n, 10)),
    );
    let score = largest || 16;
    if (rel.includes("apple-touch-icon")) score += 200;
    if (/\.svg(\?|#|$)/i.test(href)) score += 120;
    if (rel.includes("mask-icon")) score -= 150;

    candidates.push({ href, score });
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0]?.href;
  const resolved = best ? absoluteFrom(decodeEntities(best), baseUrl) : undefined;
  // Every site answers /favicon.ico even when it declares nothing.
  return resolved ?? `${origin}/favicon.ico`;
}

/** The page's icon as a downloadable asset, ready for the offline store. */
export function siteIcon(html: string, baseUrl: string): Asset | undefined {
  const href = findFavicon(html, baseUrl);
  if (!href) return undefined;
  let label = "";
  try {
    label = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    /* label is cosmetic */
  }
  return makeAsset({ url: href, kind: "image", alt: label }) ?? undefined;
}

function attrOf(tag: string, name: string): string | undefined {
  const match =
    tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    tag.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i")) ??
    tag.match(new RegExp(`\\b${name}\\s*=\\s*([^\\s>]+)`, "i"));
  return match?.[1]?.trim();
}

function absoluteFrom(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return undefined;
  }
}

export function pageTitle(html: string): string {
  const og = html.match(
    /<meta[^>]+(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (og?.[1]) return decodeEntities(og[1]).trim();
  const alt = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["']/i,
  );
  if (alt?.[1]) return decodeEntities(alt[1]).trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return decodeEntities(title[1]).replace(/\s+/g, " ").trim();
  return "";
}

/* -------------------------------------------------------------------------- */
/* HTML to Markdown                                                           */
/* -------------------------------------------------------------------------- */

let turndown: TurndownService | null = null;

function getTurndown(): TurndownService {
  if (turndown) return turndown;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });

  td.remove(["script", "style", "noscript", "form", "nav", "footer"]);
  td.addRule("dropSvg", { filter: (node) => node.nodeName === "SVG", replacement: () => "" });

  // Clips and embedded players become image syntax; the media pass upgrades
  // them to the right element once it knows what kind of file they are.
  td.addRule("media", {
    filter: (node) => ["VIDEO", "AUDIO"].includes(node.nodeName),
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const src =
        el.getAttribute?.("src") ||
        (el.querySelector?.("source") as HTMLElement | null)?.getAttribute?.("src") ||
        "";
      if (!src) return "";
      const label = el.getAttribute?.("title") || el.getAttribute?.("aria-label") || "";
      return `\n\n![${label}](${src})\n\n`;
    },
  });

  td.addRule("embeds", {
    filter: (node) => node.nodeName === "IFRAME",
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const raw = el.getAttribute?.("src") || el.getAttribute?.("data-src") || "";
      const src = raw.startsWith("//") ? `https:${raw}` : raw;
      // Only players are worth keeping — every other iframe is furniture.
      const embed = src ? embedInfo(src) : null;
      if (!embed) return "";
      const label = el.getAttribute?.("title") || "";
      return `\n\n![${label}](${embed.watchUrl})\n\n`;
    },
  });

  /*
   * Keep fenced blocks language-tagged the way the source rendered them.
   *
   * Every <pre> counts, not just `<pre><code>`: Medium and several CMSs style
   * code with spans and no <code> element at all, and requiring one silently
   * flattened their snippets into paragraphs.
   */
  td.addRule("fencedCode", {
    filter: (node) => node.nodeName === "PRE",
    replacement: (_content, node) => {
      const pre = node as HTMLElement;
      const code = pre.querySelector?.("code") ?? null;
      const holder = (code ?? pre) as HTMLElement;
      const text = codeTextOf(holder);
      if (!text.trim()) return "";
      const lang = languageOf(code) || languageOf(pre) || "";
      return `\n\n\`\`\`${lang}\n${text.replace(/\n+$/, "")}\n\`\`\`\n\n`;
    },
  });

  td.addRule("tables", {
    filter: "table",
    replacement: (_content, node) => markdownTable(node as HTMLElement),
  });

  turndown = td;
  return td;
}

/**
 * Text of a code block with its line breaks intact. `textContent` alone drops
 * `<br>`, which is how several editors store newlines inside a snippet.
 */
function codeTextOf(node: HTMLElement): string {
  const html = node.innerHTML ?? "";
  if (!/<br/i.test(html)) return node.textContent ?? "";
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(div|p)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Reads a language hint out of the usual highlighter class conventions. */
function languageOf(node: Element | null): string {
  const className = node?.getAttribute?.("class") ?? "";
  const match = className.match(/(?:language|lang|highlight-source|brush)[-:]([\w+#]+)/i);
  const lang = match?.[1]?.toLowerCase();
  return lang && lang !== "none" && lang !== "plain" ? lang : "";
}

function markdownTable(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll?.("tr") ?? []) as HTMLElement[];
  if (!rows.length) return "";
  const cells = rows.map((row) =>
    (Array.from(row.querySelectorAll("th,td")) as HTMLElement[]).map((cell) =>
      (cell.textContent ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim(),
    ),
  );
  const width = Math.max(...cells.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const [head, ...body] = cells;
  const lines = [
    `| ${pad(head).join(" | ")} |`,
    `| ${Array(width).fill("---").join(" | ")} |`,
    ...body.map((r) => `| ${pad(r).join(" | ")} |`),
  ];
  return `\n\n${lines.join("\n")}\n\n`;
}

export function htmlToMarkdown(html: string): string {
  try {
    return getTurndown()
      .turndown(html)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return stripTags(html);
  }
}

export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Narrows a document to its most content-dense region before conversion. */
export function mainContent(html: string): string {
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const candidates: string[] = [];
  for (const tag of ["main", "article"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
    for (let m = re.exec(body); m; m = re.exec(body)) candidates.push(m[1]);
  }
  if (!candidates.length) return body;
  return candidates.reduce((best, c) => (stripTags(c).length > stripTags(best).length ? c : best));
}
