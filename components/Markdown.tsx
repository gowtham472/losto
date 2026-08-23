"use client";

import { Check, Copy, WrapText } from "lucide-react";
import { memo, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { normaliseMath } from "@/lib/markdown";
import { cn, copyText } from "@/lib/utils";

/** Pulls the plain text back out of a highlighted node tree. */
function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [wrap, setWrap] = useState(false);

  const child = Array.isArray(children) ? children[0] : children;
  const className =
    (child && typeof child === "object" && "props" in child
      ? ((child as { props: { className?: string } }).props.className ?? "")
      : "") || "";
  const language = className.match(/language-([\w+#-]+)/)?.[1] ?? "";
  const raw = nodeText(children);
  const lineCount = raw.trimEnd().split("\n").length;

  return (
    <div className="group/code my-1 overflow-hidden rounded-card bg-inset shadow-hairline">
      <div className="flex h-8 items-center justify-between gap-2 bg-surface pl-3 pr-1.5 shadow-[inset_0_-1px_0_var(--line)]">
        <span className="truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {language || "code"}
          <span className="ml-2 normal-case tracking-normal text-ink-3/70">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setWrap((v) => !v)}
            title={wrap ? "Stop wrapping lines" : "Wrap long lines"}
            aria-pressed={wrap}
            className={cn(
              "flex size-6 items-center justify-center rounded-chip transition-colors",
              wrap ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink",
            )}
          >
            <WrapText size={12} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (await copyText(raw)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
            title="Copy code"
            className="flex size-6 items-center justify-center rounded-chip text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          >
            {copied ? (
              <Check size={12} strokeWidth={2.5} className="text-green" />
            ) : (
              <Copy size={12} strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>
      <pre className={cn(wrap && "whitespace-pre-wrap break-words")}>{children}</pre>
    </div>
  );
}

const COMPONENTS: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-hidden rounded-card shadow-hairline">
      <table>{children}</table>
    </div>
  ),
  input: ({ checked, type }) =>
    type === "checkbox" ? (
      <input
        type="checkbox"
        checked={Boolean(checked)}
        readOnly
        className="mr-1.5 size-3 translate-y-px accent-[var(--accent)]"
      />
    ) : null,
};

export const Markdown = memo(function Markdown({
  content,
  typeface = "sans",
  headingPrefix,
  className,
}: {
  content: string;
  typeface?: "sans" | "serif" | "mono";
  /** Gives headings stable ids so the reader outline can jump to them. */
  headingPrefix?: string;
  className?: string;
}) {
  const source = useMemo(() => normaliseMath(content), [content]);

  const components = useMemo<Components>(() => {
    if (!headingPrefix) return COMPONENTS;
    let counter = 0;
    const heading = (Tag: "h1" | "h2" | "h3" | "h4") => {
      function Heading({ children }: { children?: ReactNode }) {
        counter += 1;
        return <Tag id={`${headingPrefix}-h${counter}`}>{children}</Tag>;
      }
      Heading.displayName = `Markdown${Tag.toUpperCase()}`;
      return Heading;
    };
    return {
      ...COMPONENTS,
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      h4: heading("h4"),
    };
  }, [headingPrefix]);

  return (
    <div className={cn("prose-losto", className)} data-typeface={typeface}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }],
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
