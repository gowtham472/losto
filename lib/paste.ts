import type { ChatMessage } from "./types";
import { uid } from "./utils";

/**
 * Turns a copy-pasted transcript into turns. Copying a chat out of the ChatGPT
 * or Claude web UI leaves speaker markers behind, so use them when they exist
 * and otherwise keep the text as one answer.
 */
const SPEAKER = new RegExp(
  String.raw`^\s*(?:\*\*)?(You said|ChatGPT said|Claude said|Assistant|ChatGPT|Claude|You|User|Q|A|Question|Answer)(?:\*\*)?\s*[:：]\s*`,
  "i",
);

const USER_SPEAKERS = /^(you|you said|user|q|question)$/i;

export function splitPastedTranscript(text: string): ChatMessage[] {
  // A lone \r is a line ending too, and is what a PDF or Word copy leaves
  // behind. Normalising here keeps the stored markdown to one convention.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const turns: { role: ChatMessage["role"]; lines: string[] }[] = [];

  for (const line of lines) {
    const match = line.match(SPEAKER);
    if (match) {
      const speaker = match[1].trim();
      const rest = line.slice(match[0].length);
      turns.push({
        role: USER_SPEAKERS.test(speaker) ? "user" : "assistant",
        lines: rest.trim() ? [rest] : [],
      });
      continue;
    }
    if (!turns.length) turns.push({ role: "assistant", lines: [] });
    turns[turns.length - 1].lines.push(line);
  }

  const messages = turns
    .map((turn) => ({
      id: uid("m"),
      role: turn.role,
      content: turn.lines.join("\n").trim(),
    }))
    .filter((m) => m.content);

  // Fewer than two turns means the markers were not really there.
  if (messages.length < 2) {
    const body = text.trim();
    return body ? [{ id: uid("m"), role: "assistant", content: body }] : [];
  }
  return messages;
}

/** A readable first line for a pasted chunk, used when no title is given. */
export function titleFromPaste(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.replace(/^#{1,6}\s*/, "").replace(SPEAKER, "").trim())
    .find((l) => l.length > 3);
  if (!line) return "Pasted notes";
  return line.length > 70 ? `${line.slice(0, 70).replace(/\s+\S*$/, "")}…` : line;
}
