/**
 * Importing a conversation by asking the assistant to hand it over.
 *
 * Pasting a transcript works, but it arrives as whatever the clipboard made of
 * it - speaker labels guessed at, wrapping baked in, tables flattened. This
 * route asks the assistant for the same conversation as JSON instead. It knows
 * exactly where its own turns begin and end, so nothing has to be inferred, and
 * the reader still does all the moving: no fetching, no endpoint, no terms to
 * weigh.
 *
 * The shape is deliberately small. Every field an assistant has to remember is
 * a field it can get wrong.
 */
import type { ChatMessage, ExtractResult, Role, SourceId } from "./types";
import { deriveTitle, uid } from "./utils";

export class StructuredProblem extends Error {}

/** What the reader copies into their assistant. */
export const STRUCTURED_PROMPT = `Reply with nothing but a single JSON object, in a \`\`\`json code block, in exactly this shape:

{
  "losto": 1,
  "title": "a short title for this conversation",
  "messages": [
    { "role": "user", "content": "what I asked, in Markdown" },
    { "role": "assistant", "content": "your reply, in Markdown" }
  ]
}

Rules:
- Include every turn of this conversation so far, oldest first, including this one's context but not this instruction itself.
- Reproduce each turn faithfully. Do not summarise, shorten, tidy or improve anything.
- Keep the Markdown inside "content" exactly as it was: headings, numbered lists, tables, code blocks, LaTeX.
- "role" is exactly "user" or "assistant". Nothing else.
- Valid JSON only. Escape quotes and newlines properly.
- No explanation before or after the code block.`;

interface RawMessage {
  role?: unknown;
  content?: unknown;
  text?: unknown;
}

/**
 * Reads what the assistant gave back.
 *
 * Assistants wrap JSON in a code fence, or introduce it with a sentence, or
 * both. None of that is worth failing over, so the object is dug out rather
 * than demanded.
 */
export function readStructured(input: string, source: SourceId = "manual"): ExtractResult {
  const parsed = parseLoosely(input);
  const root = parsed as Record<string, unknown>;

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(root?.messages)
      ? (root.messages as unknown[])
      : null;

  if (!list) {
    throw new StructuredProblem(
      "That JSON has no \"messages\" array in it. Copy the prompt again and make sure the whole reply came across.",
    );
  }

  const messages: ChatMessage[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as RawMessage;

    const role = normaliseRole(raw.role);
    if (!role) continue;

    const content = typeof raw.content === "string" ? raw.content : typeof raw.text === "string" ? raw.text : "";
    if (!content.trim()) continue;

    messages.push({ id: uid("m"), role, content: content.trim() });
  }

  if (!messages.length) {
    throw new StructuredProblem("There were no usable turns in that JSON.");
  }

  const title = typeof root?.title === "string" && root.title.trim() ? root.title.trim() : deriveTitle(messages);

  return {
    ok: true,
    title,
    source,
    // Nothing was fetched, so there is no address to point at.
    sourceUrl: "",
    messages,
    strategy: "structured:pasted",
  };
}

/**
 * Digs a JSON value out of a reply that may be fenced, prefaced, or both.
 * Falls back to the outermost braces or brackets in the text.
 */
function parseLoosely(input: string): unknown {
  const text = input.trim();
  if (!text) throw new StructuredProblem("Paste the JSON your assistant replied with.");

  const candidates: string[] = [];

  // ```json … ``` or a bare ``` … ``` fence.
  for (const match of text.matchAll(/```(?:json|jsonc)?\s*\n?([\s\S]*?)```/gi)) {
    if (match[1]?.trim()) candidates.push(match[1].trim());
  }
  candidates.push(text);

  // Whatever sits between the first opening brace and the last closing one.
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try the next shape */
    }
  }

  throw new StructuredProblem(
    "That is not valid JSON. Copy the whole reply, including its opening and closing braces.",
  );
}

function normaliseRole(value: unknown): Role | null {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "user" || role === "human" || role === "you") return "user";
  if (role === "assistant" || role === "ai" || role === "model" || role === "bot") return "assistant";
  return null;
}
