/**
 * Decoder for the React Router streaming payload that chatgpt.com embeds in its
 * public `/share/<id>` page.
 *
 * The payload is a flat array where every value is addressed by index:
 *   ["loaderData" is at 1]  {"_1": 2}  means  { [A[1]]: A[2] }
 * Objects encode each entry as `_<keyIndex>: valueIndex`, arrays hold indices,
 * and negative indices are placeholders for undefined and friends. Rebuilding it
 * lets Losto read the conversation from the page robots.txt permits, instead of
 * the private API endpoint it does not.
 */

const ENQUEUE_RE = /streamController\.enqueue\(\s*("(?:[^"\\]|\\.)*")\s*\)/g;

/** Pulls every streamed chunk out of the HTML and joins them back together. */
export function readStreamPayload(html: string): unknown[] | null {
  const chunks: string[] = [];
  for (let m = ENQUEUE_RE.exec(html); m; m = ENQUEUE_RE.exec(html)) {
    try {
      // The argument is a JavaScript string literal, which is also valid JSON.
      chunks.push(JSON.parse(m[1]) as string);
    } catch {
      /* a chunk we cannot read is skipped rather than failing the whole page */
    }
  }
  ENQUEUE_RE.lastIndex = 0;
  if (!chunks.length) return null;

  const joined = chunks.join("");
  const parsed = parseLeadingJsonArray(joined);
  return Array.isArray(parsed) ? parsed : null;
}

/**
 * The stream may carry several JSON documents back to back. Only the first is
 * the router payload, so read exactly one balanced array and ignore the rest.
 */
function parseLeadingJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  if (start === -1) return null;

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
    else if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Wrapper types turbo-stream puts in front of a value; we keep it simple. */
const TYPE_MARKERS = new Set([
  "Date",
  "Map",
  "Set",
  "Promise",
  "RegExp",
  "BigInt",
  "URL",
  "Error",
  "Symbol",
  "preset",
]);

/**
 * Rebuilds the real object graph from the flat array. Cycles are handled, and
 * anything unrecognised degrades to null rather than throwing.
 */
export function hydrate(flat: unknown[], index = 0): unknown {
  const memo = new Map<number, unknown>();

  const walk = (i: number, depth: number): unknown => {
    if (depth > 200) return null;
    if (i < 0 || i >= flat.length) return undefined;
    if (memo.has(i)) return memo.get(i);

    const value = flat[i];

    if (value === null || typeof value !== "object") {
      memo.set(i, value);
      return value;
    }

    if (Array.isArray(value)) {
      if (typeof value[0] === "string" && TYPE_MARKERS.has(value[0])) {
        // Typed wrappers carry their payload in the second slot.
        if (value[0] === "Date" && typeof value[1] === "number") {
          const date = new Date(walk(value[1], depth + 1) as number);
          memo.set(i, date);
          return date;
        }
        const inner = typeof value[1] === "number" ? walk(value[1], depth + 1) : null;
        memo.set(i, inner);
        return inner;
      }
      const arr: unknown[] = [];
      memo.set(i, arr);
      for (const entry of value) {
        arr.push(typeof entry === "number" ? walk(entry, depth + 1) : entry);
      }
      return arr;
    }

    const out: Record<string, unknown> = {};
    memo.set(i, out);
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      const keyIndex = rawKey.startsWith("_") ? Number(rawKey.slice(1)) : Number.NaN;
      const key = Number.isFinite(keyIndex) ? String(walk(keyIndex, depth + 1)) : rawKey;
      out[key] = typeof rawValue === "number" ? walk(rawValue, depth + 1) : rawValue;
    }
    return out;
  };

  return walk(index, 0);
}

/** Convenience: decode a page's router payload in one call. */
export function decodeReactRouterPage(html: string): unknown | null {
  const flat = readStreamPayload(html);
  if (!flat) return null;
  try {
    return hydrate(flat, 0);
  } catch {
    return null;
  }
}
