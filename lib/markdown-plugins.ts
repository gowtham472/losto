/**
 * The pipeline between a saved answer and what the reader draws.
 *
 * Everything here works on the parsed tree, never on the source text. That is
 * deliberate: heading ids are keyed to source lines (see `collectHeadings`), so
 * a step that rewrote the Markdown before parsing would shift every anchor.
 *
 * The order the plugins run in matters and is fixed in `components/Markdown.tsx`:
 *
 *   remarkLosto        callouts, diagram detection, literal tags, code meta
 *   rehype-raw         turns the few HTML tags assistants emit into elements
 *   rehype-sanitize    drops everything not on SANITIZE_SCHEMA
 *   rehype-katex       maths
 *   rehype-highlight   syntax colours
 *   rehypeCodeLines    one element per line, for numbers and highlights
 *
 * Sanitising comes before KaTeX and the highlighter so their own markup does
 * not need allow-listing, and after rehype-raw so nothing raw gets past it.
 */
import { defaultSchema } from "rehype-sanitize";
import { looksLikeMermaid } from "./mermaid";

/* -------------------------------------------------------------------------- */
/* just enough of the tree types to walk them                                 */
/* -------------------------------------------------------------------------- */

export interface TreeNode {
  type: string;
  value?: string;
  tagName?: string;
  lang?: string | null;
  meta?: string | null;
  properties?: Record<string, unknown>;
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
  children?: TreeNode[];
  position?: { start: { line: number } };
}

function walk(
  node: TreeNode,
  visit: (node: TreeNode, parent: TreeNode | null, index: number) => void,
  parent: TreeNode | null = null,
  index = 0,
) {
  visit(node, parent, index);
  // Read the list afresh each turn: a visitor may replace the node it was given.
  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    walk(node.children![i], visit, node, i);
  }
}

/** The text inside a node, with every element flattened away. */
export function treeText(node: TreeNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(treeText).join("");
}

function classList(node: TreeNode | undefined): string[] {
  const value = node?.properties?.className;
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" ? value.split(/\s+/) : [];
}

/**
 * The text of a `<code>` element as it was written. Once the code has been
 * split into lines the breaks between them are no longer in the tree, so they
 * are put back here.
 */
export function codeSource(code: TreeNode | undefined): string {
  const lines = code?.children ?? [];
  const split = lines.length > 0 && lines.every((line) => classList(line).includes("line"));
  return split ? lines.map(treeText).join("\n") : treeText(code).replace(/\n$/, "");
}

/** The language a `<code>` element was fenced with, or "" if it named none. */
export function codeLanguage(code: TreeNode | undefined): string {
  if (code?.properties && "dataUnlabelled" in code.properties) return "";
  return (
    classList(code)
      .find((name) => name.startsWith("language-"))
      ?.slice("language-".length) ?? ""
  );
}

/* -------------------------------------------------------------------------- */
/* remark: callouts, diagrams, literal tags                                   */
/* -------------------------------------------------------------------------- */

export const CALLOUT_KINDS = ["note", "tip", "important", "warning", "caution"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

const CALLOUT_MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\r?\n|$)/i;

/** Tags rehype-raw is allowed to turn into elements. Anything else stays text. */
const EXTRA_TAGS = ["mark", "u", "abbr", "small", "figure", "figcaption", "center", "caption", "col", "colgroup"];
const KNOWN_TAGS = new Set([...(defaultSchema.tagNames ?? []), ...EXTRA_TAGS]);

/** Containers whose children are blocks, so loose text needs a paragraph. */
const FLOW_PARENTS = new Set(["root", "blockquote", "listItem", "footnoteDefinition"]);

function isSvgDocument(value: string): boolean {
  const text = value.trim();
  return /^(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text) && /<\/svg>\s*$/i.test(text);
}

export function remarkLosto() {
  return (tree: TreeNode) => {
    walk(tree, (node, parent, index) => {
      /*
       * `> [!NOTE]` and friends. The marker is plain text as far as Markdown is
       * concerned, so it is lifted off the first line and the quote is tagged.
       */
      if (node.type === "blockquote") {
        const first = node.children?.[0];
        const lead = first?.type === "paragraph" ? first.children?.[0] : undefined;
        const match = lead?.type === "text" ? lead.value?.match(CALLOUT_MARKER) : null;
        if (first && lead && match) {
          lead.value = lead.value!.slice(match[0].length);
          if (!lead.value) first.children!.shift();
          // A marker followed by a hard line break leaves that break in front.
          if (first.children?.[0]?.type === "break") first.children.shift();
          if (!first.children?.length) node.children!.shift();
          node.data = {
            ...node.data,
            hProperties: { ...node.data?.hProperties, dataCallout: match[1].toLowerCase() },
          };
        }
        return;
      }

      if (node.type === "code") {
        const value = node.value ?? "";
        const lang = (node.lang ?? "").toLowerCase();
        /*
         * Assistants forget the label about as often as they remember it, and a
         * flowchart shown as eight lines of arrows helps nobody.
         */
        if (!lang && looksLikeMermaid(value)) node.lang = "mermaid";
        else if ((!lang || lang === "xml" || lang === "html") && isSvgDocument(value)) node.lang = "svg";

        /*
         * The highlighter guesses a language for a fence that named none, which
         * is right for colouring and wrong for labelling: a block marked as SQL
         * because it contained the word "select" misleads. The fence says so
         * here, and the label stays generic.
         */
        const hProperties: Record<string, unknown> = { ...node.data?.hProperties };
        if (node.meta) hProperties.dataMeta = node.meta;
        if (!node.lang) hProperties.dataUnlabelled = "";
        if (Object.keys(hProperties).length) node.data = { ...node.data, hProperties };
        return;
      }

      /*
       * `List<String>` in a sentence parses as an HTML tag. Left alone, rehype-raw
       * would build a <string> element, the sanitiser would unwrap it, and the
       * type parameter would vanish from the answer. Anything that is not a tag
       * the sanitiser keeps is therefore put back as the text it was written as.
       */
      if (node.type === "html" && parent?.children) {
        const value = node.value ?? "";
        const name = value.match(/^\s*<\/?([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
        const keep = (name && KNOWN_TAGS.has(name)) || /^\s*<!--/.test(value);
        if (keep) return;

        const text: TreeNode = { type: "text", value };
        parent.children[index] = FLOW_PARENTS.has(parent.type)
          ? { type: "paragraph", children: [text] }
          : text;
      }
    });
  };
}

/* -------------------------------------------------------------------------- */
/* sanitising                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * GitHub's allow-list, widened by the handful of things the renderer itself
 * puts into the tree before sanitising. `style`, event handlers, scripts,
 * iframes and forms are all still dropped.
 */
export const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...KNOWN_TAGS],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"], "dataMeta", "dataUnlabelled"],
    blockquote: [...(defaultSchema.attributes?.blockquote ?? []), "dataCallout"],
    img: [...(defaultSchema.attributes?.img ?? []), "title"],
    abbr: ["title"],
  },
  /*
   * Ids are left as written. Footnote references and their targets are emitted
   * as a matched pair, and prefixing one side here would break every one of
   * them; they are namespaced per message where they are generated instead.
   */
  clobber: ["name"],
  protocols: {
    ...defaultSchema.protocols,
    // Media saved on the device is referenced through this scheme.
    src: [...(defaultSchema.protocols?.src ?? []), "losto-asset"],
  },
};

/* -------------------------------------------------------------------------- */
/* rehype: one element per line of code                                       */
/* -------------------------------------------------------------------------- */

/** Fences that are drawn rather than listed, so numbering them means nothing. */
export const DRAWN_LANGUAGES = new Set(["mermaid", "svg"]);

/** `{1,4-6}` in a fence's info string, as a set of 1-based line numbers. */
export function highlightedLines(meta: string): Set<number> {
  const out = new Set<number>();
  const body = meta.match(/\{([\d\s,-]+)\}/)?.[1];
  if (!body) return out;
  for (const part of body.split(",")) {
    const [from, to] = part.split("-").map((n) => Number.parseInt(n, 10));
    if (!Number.isFinite(from)) continue;
    const end = Number.isFinite(to) ? Math.min(to, from + 5000) : from;
    for (let line = from; line <= end; line++) out.add(line);
  }
  return out;
}

/** `title="server.ts"`, `filename=server.ts`, or a bare `server.ts`. */
export function codeTitle(meta: string): string {
  const named = meta.match(/(?:title|filename|file|name)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\S+))/i);
  if (named) return named[1] ?? named[2] ?? named[3] ?? "";
  const bare = meta.replace(/\{[^}]*\}/g, "").trim();
  return /^[\w./\\@-]+\.\w{1,8}$/.test(bare) ? bare : "";
}

/**
 * Splits highlighted code into lines. A token that spans a line break - a block
 * comment, a template string - is closed at the break and reopened after it, so
 * every line is a self-contained run of the same markup.
 */
function splitLines(nodes: TreeNode[]): TreeNode[][] {
  const lines: TreeNode[][] = [[]];
  for (const node of nodes) {
    if (node.type === "text") {
      (node.value ?? "").split("\n").forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push({ type: "text", value: part });
      });
    } else if (node.type === "element") {
      splitLines(node.children ?? []).forEach((inner, i) => {
        if (i > 0) lines.push([]);
        if (inner.length) lines[lines.length - 1].push({ ...node, children: inner });
      });
    }
  }
  return lines;
}

export function rehypeCodeLines() {
  return (tree: TreeNode) => {
    walk(tree, (node) => {
      if (node.type !== "element" || node.tagName !== "pre") return;
      const code = node.children?.find((child) => child.tagName === "code");
      if (!code?.children) return;

      const language = codeLanguage(code);
      if (DRAWN_LANGUAGES.has(language)) return;

      const lines = splitLines(code.children);
      // A fence's closing newline is not a line of its own.
      if (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();

      const marked = highlightedLines(String(code.properties?.dataMeta ?? ""));
      const isDiff = language === "diff" || language === "patch";

      code.children = lines.map((children, i) => {
        const properties: Record<string, unknown> = { className: ["line"] };
        if (marked.has(i + 1)) properties.dataMarked = "";
        if (isDiff) {
          const lead = treeText({ type: "root", children })[0];
          if (lead === "+") properties.dataDiff = "add";
          else if (lead === "-") properties.dataDiff = "del";
          else if (lead === "@") properties.dataDiff = "hunk";
        }
        return {
          type: "element",
          tagName: "span",
          properties,
          /*
           * No line break is kept: each line is a block, and a block already
           * ends its line. Leaving the break in as well makes a hand-made
           * selection copy with a blank line after every line of code.
           */
          children,
        };
      });
    });
  };
}
