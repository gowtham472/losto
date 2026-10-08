"use client";

import { Info, Lightbulb, MessageSquareWarning, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { memo, useId, useMemo, type MouseEvent, type ReactNode } from "react";
import ReactMarkdown, {
  type Components,
  type ExtraProps,
  type Options,
  defaultUrlTransform,
} from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { MediaNode } from "@/components/Media";
import { CodeBlock, SvgBlock, describeCode } from "@/components/markdown/CodeBlock";
import { Diagram } from "@/components/markdown/Diagram";
import { Table, TableBody, TableHead, TableHeading } from "@/components/markdown/Table";
import { normaliseMath } from "@/lib/markdown";
import {
  SANITIZE_SCHEMA,
  rehypeCodeLines,
  remarkLosto,
  type CalloutKind,
  type TreeNode,
} from "@/lib/markdown-plugins";
import { ASSET_SCHEME } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * react-markdown strips any scheme it does not recognise, which would wipe out
 * every `losto-asset:` reference. Let those through and sanitise the rest as
 * usual.
 */
function transformUrl(url: string): string {
  return url.startsWith(ASSET_SCHEME) ? url : defaultUrlTransform(url);
}

/** True when a paragraph holds nothing but media, so the wrapper can be dropped. */
function isMediaOnly(node: unknown): boolean {
  const children = (node as { children?: { type?: string; tagName?: string; value?: string }[] })
    ?.children;
  if (!children?.length) return false;
  return children.every(
    (child) =>
      child.tagName === "img" ||
      (child.type === "text" && !child.value?.trim()),
  );
}

/** A link to somewhere else in the same answer - a footnote and its way back. */
function jumpWithin(event: MouseEvent<HTMLAnchorElement>) {
  const id = decodeURIComponent(event.currentTarget.getAttribute("href")?.slice(1) ?? "");
  const target = id ? document.getElementById(id) : null;
  // The address bar is left alone: the reader's own route lives in it.
  event.preventDefault();
  if (!target) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
}

const CALLOUTS: Record<CalloutKind, { label: string; icon: LucideIcon }> = {
  note: { label: "Note", icon: Info },
  tip: { label: "Tip", icon: Lightbulb },
  important: { label: "Important", icon: MessageSquareWarning },
  warning: { label: "Warning", icon: TriangleAlert },
  caution: { label: "Caution", icon: OctagonAlert },
};

function Callout({ kind, children }: { kind: CalloutKind; children?: ReactNode }) {
  const { label, icon: Icon } = CALLOUTS[kind];
  return (
    <div className="callout" data-callout={kind} role="note">
      <p className="callout-title">
        <Icon size={12} strokeWidth={2.4} aria-hidden />
        {label}
      </p>
      <div className="callout-body">{children}</div>
    </div>
  );
}

const COMPONENTS: Components = {
  pre: ({ node, children }) => {
    const { language, source } = describeCode(node as TreeNode);
    if (language === "mermaid") return <Diagram code={source} />;
    if (language === "svg") return <SvgBlock source={source}>{children}</SvgBlock>;
    return <CodeBlock node={node as TreeNode}>{children}</CodeBlock>;
  },
  img: ({ src, alt }) => <MediaNode src={typeof src === "string" ? src : undefined} alt={alt} />,
  // Figures and video cannot live inside a <p>, so unwrap media-only paragraphs.
  p: ({ node, children }) =>
    isMediaOnly(node) ? <>{children}</> : <p>{children}</p>,
  // Everything else on the element is kept: footnote links carry the ids their way back needs.
  a: ({ node, href, children, ...rest }) => {
    void node;
    return href?.startsWith("#") ? (
      <a {...rest} href={href} onClick={jumpWithin}>
        {children}
      </a>
    ) : (
      <a {...rest} href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  },
  blockquote: ({ node, children }) => {
    const kind = node?.properties?.dataCallout as CalloutKind | undefined;
    return kind && kind in CALLOUTS ? (
      <Callout kind={kind}>{children}</Callout>
    ) : (
      <blockquote>{children}</blockquote>
    );
  },
  table: ({ node, children }) => <Table node={node as TreeNode}>{children}</Table>,
  thead: ({ children }) => <TableHead>{children}</TableHead>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  th: ({ node, children }) => <TableHeading node={node as TreeNode}>{children}</TableHeading>,
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

/** The same, with diagrams and drawings left as the code they were written as. */
const PLAIN_COMPONENTS: Components = {
  ...COMPONENTS,
  pre: ({ node, children }) => <CodeBlock node={node as TreeNode}>{children}</CodeBlock>,
};

const REMARK_PLUGINS: Options["remarkPlugins"] = [remarkGfm, remarkMath, remarkLosto];

/* The order is load-bearing - see the note at the top of lib/markdown-plugins.ts. */
const REHYPE_PLUGINS: Options["rehypePlugins"] = [
  rehypeRaw,
  [rehypeSanitize, SANITIZE_SCHEMA],
  [rehypeKatex, { throwOnError: false, strict: false, output: "htmlAndMathml" }],
  [rehypeHighlight, { detect: true, ignoreMissing: true }],
  rehypeCodeLines,
];

export const Markdown = memo(function Markdown({
  content,
  typeface = "sans",
  headingPrefix,
  rich = true,
  className,
}: {
  content: string;
  typeface?: "sans" | "serif" | "mono";
  /** Gives headings stable ids so the reader outline can jump to them. */
  headingPrefix?: string;
  /**
   * Draw diagrams and SVG. Off for previews of a clipped answer, where a fence
   * cut in half would only ever fail to draw.
   */
  rich?: boolean;
  className?: string;
}) {
  const source = useMemo(() => normaliseMath(content), [content]);

  // Footnote ids must be unique on a page holding many answers, each with a [^1].
  const generated = useId().replace(/[^a-zA-Z0-9]/g, "");
  const namespace = headingPrefix ?? `md${generated}`;
  const remarkRehypeOptions = useMemo(() => ({ clobberPrefix: `${namespace}-` }), [namespace]);

  const components = useMemo<Components>(() => {
    const base = rich ? COMPONENTS : PLAIN_COMPONENTS;
    if (!headingPrefix) return base;
    /*
     * The id comes from the source line, never a running count. A counter has to
     * survive across renders to keep its place, and then every id shifts the
     * next time this re-renders - the one thing a link pointing into the middle
     * of an answer cannot tolerate.
     */
    const heading = (Tag: "h1" | "h2" | "h3" | "h4") =>
      function Heading({
        node,
        children,
        id,
        className: headingClass,
      }: { children?: ReactNode; id?: string; className?: string } & ExtraProps) {
        const line = node?.position?.start.line;
        return (
          // The footnotes heading is generated, so it arrives with an id and no line.
          <Tag id={line ? `${headingPrefix}-h${line}` : id} className={headingClass}>
            {children}
          </Tag>
        );
      };
    return {
      ...base,
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      h4: heading("h4"),
    };
  }, [headingPrefix, rich]);

  return (
    <div className={cn("prose-losto", className)} data-typeface={typeface}>
      <ReactMarkdown
        urlTransform={transformUrl}
        remarkPlugins={REMARK_PLUGINS}
        remarkRehypeOptions={remarkRehypeOptions}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
});
