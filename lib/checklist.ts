/**
 * Pulls the individual questions out of a saved conversation.
 *
 * The case this exists for: a student pastes a whole question bank in one go and
 * gets one long answer back. The transcript is two turns, so anything that
 * counts messages sees one question where there are forty.
 *
 * Two places hold that list. The question itself, when it survived the paste as
 * a real line-per-question list. And the answer, which restates each question
 * before answering it - the more reliable of the two, because a bank copied out
 * of a Word table arrives as one flat paragraph with the numbering buried
 * mid-sentence, while the assistant lays it back out properly.
 */
import { LINE_BREAK, collectHeadings, normaliseMath } from "./markdown";
import type { ChatMessage } from "./types";
import { stripMarkdown, truncate } from "./utils";

export interface ChecklistItem {
  /** Stable across reloads - derived from the message and the item's place in it. */
  id: string;
  /** The number as written, or the position when the source had none. */
  number: number;
  /** Plain-text label for the row. */
  text: string;
  /** Element id to scroll to, so a row can jump to its answer. */
  anchor: string;
  /** Heading this question sits under, when the answer is grouped into sections. */
  section?: string;
}

/**
 * "Question 4:" / "Q4." first, then a plain "4." or "4)". The trailing text is
 * allowed to be empty: a bank copied out of a PDF often leaves the number alone
 * on its line with the question wrapped onto the next.
 */
const NUMBERED: RegExp[] = [
  /^q(?:uestion)?\s*(\d{1,3})\s*[.):\]-]?\s*(.*)$/i,
  /^(\d{1,3})\s*[.):\]-]\s*(.*)$/,
];

/** A line that is entirely bold is how assistants mark a restated question. */
const BOLD_LINE = /^\s{0,3}(?:\*\*|__).*(?:\*\*|__)\s*$/;

const FENCE = /^\s{0,3}(?:```|~~~)/;
const HEADING = /^\s{0,3}#{1,4}\s+\S/;

/** The number a line opens with, whether or not it carries any text. */
function parseMarker(line: string): { n: number; text: string } | null {
  for (const pattern of NUMBERED) {
    const match = line.match(pattern);
    if (!match) continue;
    const n = Number(match[1]);
    // Three digits is already generous for a question bank; more is a year or
    // a figure that happens to start a line.
    if (!Number.isInteger(n) || n < 1 || n > 999) continue;
    return { n, text: match[2].trim() };
  }
  return null;
}

/** A numbered line carrying enough text to stand as a question by itself. */
function parseNumbered(line: string): { n: number; text: string } | null {
  const marker = parseMarker(line);
  return marker && marker.text.length >= 8 ? marker : null;
}

/** Takes the markdown decoration off a line so the numbering can be read. */
function decorationOff(raw: string): string {
  return raw
    .replace(/^\s{0,3}>\s?/, "")
    .replace(/^\s{0,3}#{1,6}\s+/, "")
    .replace(/^\s{0,3}[-*+]\s+/, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/\*\*|__/g, "")
    .trim()
    .replace(/^[*_]+|[*_]+$/g, "")
    .trim();
}

interface ScannedLine {
  /** 1-based line in the normalised source, which is what heading ids encode. */
  index: number;
  bare: string;
  heading: boolean;
  bold: boolean;
  blank: boolean;
}

/** Every line outside a fenced block - code is full of numbered lines. */
function scan(markdown: string): ScannedLine[] {
  const out: ScannedLine[] = [];
  let fenced = false;
  normaliseMath(markdown)
    .split(LINE_BREAK)
    .forEach((raw, i) => {
      if (FENCE.test(raw)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      out.push({
        index: i + 1,
        bare: decorationOff(raw),
        heading: HEADING.test(raw),
        bold: BOLD_LINE.test(raw),
        blank: !raw.trim(),
      });
    });
  return out;
}

function label(markdown: string): string {
  return truncate(stripMarkdown(markdown), 200);
}

/**
 * The numbered questions written out inside one message.
 *
 * A bank copied from a PDF keeps the page's line breaks, so a question wraps
 * across two or three lines and the number is often left stranded on one of its
 * own. Each item therefore runs on until a blank line or the next number.
 */
function listedIn(markdown: string): { n: number; text: string }[] {
  const lines = scan(markdown);
  const found: { n: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const marker = parseMarker(lines[i].bare);
    if (!marker) continue;

    const parts = marker.text ? [marker.text] : [];
    let end = i + 1;
    while (end < lines.length && !lines[end].blank && !parseMarker(lines[end].bare)) {
      parts.push(lines[end].bare);
      end += 1;
    }
    i = end - 1;

    const text = parts.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= 8) found.push({ n: marker.n, text });
  }

  return found;
}

type Restated = ChecklistItem & { n: number };

/**
 * The questions an answer restates before answering them.
 *
 * A numbered line counts when it is set apart as a question: a heading, a line
 * that is entirely bold, or a line followed by prose rather than by the next
 * number. That last test is what separates a question bank from a list of steps
 * - steps run consecutively, questions have their answer in between.
 */
function restatedIn(message: ChatMessage): Restated[] {
  const lines = scan(message.content);
  const headingId = new Map<number, string>();
  for (const heading of collectHeadings(message.content, message.id)) {
    headingId.set(heading.line, heading.id);
  }

  // Strongest form first: a numbered heading, then a wholly bold line, then a
  // bare numbered line that has prose under it.
  const byForm: [Restated[], Restated[], Restated[]] = [[], [], []];
  let section: string | undefined;
  let sectionAnchor: string | undefined;

  lines.forEach((line, i) => {
    const numbered = parseNumbered(line.bare);

    if (!numbered) {
      // An unnumbered heading is the module or part the questions sit under.
      if (line.heading && line.bare) {
        section = line.bare;
        sectionAnchor = headingId.get(line.index);
      }
      return;
    }

    let form: number;
    if (line.heading) form = 0;
    else if (line.bold) form = 1;
    else {
      const next = lines.slice(i + 1).find((l) => !l.blank);
      if (!next || parseMarker(next.bare)) return;
      form = 2;
    }

    byForm[form].push({
      id: `${message.id}#l${line.index}`,
      n: numbered.n,
      number: numbered.n,
      text: label(numbered.text),
      anchor: headingId.get(line.index) ?? sectionAnchor ?? `msg-${message.id}`,
      section,
    });
  });

  /*
   * Take the strongest form present rather than mixing them. An answer that
   * restates its questions as headings also contains numbered lists *inside*
   * each answer, and the last entry of one of those lists is followed by prose
   * exactly like a question is. Once headings are on the table, they are the
   * questions and everything else is answer text.
   */
  return byForm.find((group) => group.length) ?? [];
}

/** Questions as the reader wrote them, falling back to one row per turn. */
function askedIn(messages: ChatMessage[]): { items: ChecklistItem[]; enumerated: boolean } {
  const items: ChecklistItem[] = [];
  let enumerated = false;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== "user") continue;

    // Everything up to the next question, so a reply split over several
    // messages still gets searched for anchors.
    const answers: Restated[] = [];
    for (let j = i + 1; j < messages.length && messages[j].role !== "user"; j++) {
      if (messages[j].role === "assistant") answers.push(...restatedIn(messages[j]));
    }
    const questions = listedIn(message.content);
    const fallbackAnchor = `msg-${message.id}`;

    if (questions.length >= 2) {
      enumerated = true;
      // Match on the number the reader wrote. Position is only trustworthy when
      // the answer restated exactly as many questions as there were.
      const positional = answers.length === questions.length;
      questions.forEach((question, index) => {
        const match = answers.find((a) => a.n === question.n) ?? (positional ? answers[index] : undefined);
        items.push({
          id: `${message.id}#${index}`,
          number: question.n,
          text: label(question.text),
          anchor: match?.anchor ?? fallbackAnchor,
          section: match?.section,
        });
      });
      continue;
    }

    const text = label(message.content);
    if (text) {
      items.push({
        id: `${message.id}#0`,
        number: items.length + 1,
        text,
        anchor: fallbackAnchor,
      });
    }
  }

  return { items, enumerated };
}

/**
 * Builds the checklist for a conversation.
 *
 * A list the reader wrote themselves wins, because their own numbering is what
 * they will be looking for. Only when no turn holds one does the answer's
 * restatement stand in - which is the usual outcome for a bank pasted out of a
 * table, where the numbering ends up mid-paragraph and no line starts with it.
 */
export function buildChecklist(messages: ChatMessage[]): ChecklistItem[] {
  const asked = askedIn(messages);

  const restated: ChecklistItem[] = [];
  for (const message of messages) {
    if (message.role === "assistant") restated.push(...restatedIn(message));
  }

  if (asked.enumerated && !underParsed(asked.items, restated)) return asked.items;
  if (restated.length >= 2) return restated;
  return asked.items;
}

/**
 * A question list that does not begin at 1 has lost its opening entries. The
 * usual cause is a paste whose line endings did not survive, welding the first
 * few questions into one line. When the answer restated a longer list that does
 * start at 1, that one is the better checklist.
 */
function underParsed(asked: ChecklistItem[], restated: ChecklistItem[]): boolean {
  if (!asked.length || asked[0].number === 1) return false;
  return restated.length > asked.length && restated[0]?.number === 1;
}

/**
 * How far through a checklist a reader is. Ticks for rows that no longer exist
 * are ignored rather than counted, so a restored backup cannot read as 12/8.
 */
export function checklistProgress(
  items: ChecklistItem[],
  studied: string[] | undefined,
): { done: number; total: number; percent: number } {
  const ticked = new Set(studied ?? []);
  const done = items.reduce((n, item) => n + (ticked.has(item.id) ? 1 : 0), 0);
  return {
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  };
}
