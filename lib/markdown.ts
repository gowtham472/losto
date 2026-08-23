/**
 * Assistants are inconsistent about maths delimiters: ChatGPT emits \( \) and
 * \[ \], Claude prefers $ and $$. remark-math only understands the dollar form,
 * so normalise everything outside code spans and fences before rendering.
 */
export function normaliseMath(markdown: string): string {
  return mapOutsideCode(markdown, (segment) =>
    segment
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `\n$$\n${body.trim()}\n$$\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body.trim()}$`),
  );
}

/** Applies `transform` to the prose, leaving fenced blocks and code spans intact. */
export function mapOutsideCode(markdown: string, transform: (segment: string) => string): string {
  const parts = markdown.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
  return parts
    .map((part, index) => (index % 2 === 1 ? part : transform(part)))
    .join("");
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Headings for the reader's outline, matched to the ids the renderer assigns. */
export function collectHeadings(markdown: string, prefix: string): Heading[] {
  const out: Heading[] = [];
  let counter = 0;
  mapOutsideCode(markdown, (segment) => {
    for (const line of segment.split("\n")) {
      const match = line.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (!match) continue;
      counter += 1;
      out.push({
        id: `${prefix}-h${counter}`,
        text: match[2].replace(/[*_`]/g, "").trim(),
        level: match[1].length,
      });
    }
    return segment;
  });
  return out;
}

/**
 * Splits a transcript into question/answer pairs for study mode. Consecutive
 * turns of the same role are merged so multi-part answers stay together.
 */
export function toQuestionPairs<T extends { role: string; content: string; id: string }>(
  messages: T[],
): { id: string; question: string; answer: string; messageIds: string[] }[] {
  const pairs: { id: string; question: string; answer: string; messageIds: string[] }[] = [];
  let current: { question: string[]; answer: string[]; ids: string[] } | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (current && current.answer.length) {
        pairs.push(finish(current));
        current = null;
      }
      current ??= { question: [], answer: [], ids: [] };
      current.question.push(message.content);
      current.ids.push(message.id);
    } else if (message.role === "assistant") {
      current ??= { question: [], answer: [], ids: [] };
      current.answer.push(message.content);
      current.ids.push(message.id);
    }
  }
  if (current && (current.question.length || current.answer.length)) pairs.push(finish(current));

  return pairs.filter((p) => p.answer.trim());
}

function finish(current: { question: string[]; answer: string[]; ids: string[] }) {
  return {
    id: current.ids[0] ?? "pair",
    question: current.question.join("\n\n").trim(),
    answer: current.answer.join("\n\n").trim(),
    messageIds: current.ids,
  };
}

/** Renders a whole conversation back out as a portable markdown document. */
export function toMarkdownDocument(
  title: string,
  meta: { source: string; url: string; savedAt: number },
  messages: { role: string; content: string }[],
): string {
  const header = [
    `# ${title}`,
    "",
    `> Saved from ${meta.source}${meta.url ? ` - ${meta.url}` : ""}`,
    `> Exported from Losto on ${new Date(meta.savedAt).toLocaleDateString()}`,
    "",
    "---",
    "",
  ];
  const body = messages.map((m) =>
    m.role === "user" ? `## ${m.content.trim()}\n` : `${m.content.trim()}\n`,
  );
  return [...header, ...body].join("\n");
}
