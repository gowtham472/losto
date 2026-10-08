"use client";

import { ChevronsDownUp, ChevronsUpDown, Code2, Download, Eye, ListOrdered, WrapText } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { codeLanguage, codeSource, codeTitle, type TreeNode } from "@/lib/markdown-plugins";
import { cn, downloadFile } from "@/lib/utils";
import { CopyButton, Frame, ToolButton, usePreference } from "./Frame";

/** Blocks longer than this open folded, so one listing cannot bury an answer. */
const FOLD_AFTER = 60;
const FOLDED_LINES = 24;

const EXTENSIONS: Record<string, string> = {
  bash: "sh", shell: "sh", sh: "sh", zsh: "sh", powershell: "ps1", ps1: "ps1", bat: "bat",
  javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", ruby: "rb", rust: "rs", go: "go", java: "java", kotlin: "kt",
  swift: "swift", c: "c", cpp: "cpp", "c++": "cpp", csharp: "cs", "c#": "cs", cs: "cs",
  php: "php", sql: "sql", html: "html", xml: "xml", svg: "svg", css: "css", scss: "scss",
  json: "json", yaml: "yml", yml: "yml", toml: "toml", ini: "ini", markdown: "md", md: "md",
  latex: "tex", tex: "tex", r: "r", matlab: "m", dart: "dart", lua: "lua", perl: "pl",
  haskell: "hs", scala: "scala", diff: "diff", patch: "patch", dockerfile: "Dockerfile",
  makefile: "Makefile", graphql: "graphql", verilog: "v", vhdl: "vhd", asm: "asm",
};

function fileName(title: string, language: string): string {
  if (title) return title.split(/[\\/]/).pop() || title;
  const ext = EXTENSIONS[language.toLowerCase()] ?? "txt";
  // Dockerfile and Makefile are names, not extensions.
  return /^[A-Z]/.test(ext) ? ext : `snippet.${ext}`;
}

/** Reads what the pipeline left on the `<pre>` it handed over. */
export function describeCode(node: TreeNode | undefined) {
  const code = node?.children?.find((child) => child.tagName === "code");
  const meta = String(code?.properties?.dataMeta ?? "");
  return {
    language: codeLanguage(code),
    title: codeTitle(meta),
    source: codeSource(code),
  };
}

export function CodeBlock({ node, children }: { node?: TreeNode; children?: ReactNode }) {
  const { language, title, source } = useMemo(() => describeCode(node), [node]);
  const lineCount = source.split("\n").length;

  const [numbers, setNumbers] = usePreference("code-numbers", true);
  const [wrap, setWrap] = useState(false);
  const [open, setOpen] = useState(lineCount <= FOLD_AFTER);

  const folded = !open;
  const showNumbers = numbers && lineCount > 1;

  return (
    <Frame
      label={title || language || "code"}
      detail={
        <>
          {title && language ? `${language} · ` : ""}
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </>
      }
      actions={
        <>
          {lineCount > 1 ? (
            <ToolButton
              title={numbers ? "Hide line numbers" : "Show line numbers"}
              active={numbers}
              onClick={() => setNumbers(!numbers)}
            >
              <ListOrdered size={12} strokeWidth={2.2} />
            </ToolButton>
          ) : null}
          <ToolButton
            title={wrap ? "Stop wrapping lines" : "Wrap long lines"}
            active={wrap}
            onClick={() => setWrap((v) => !v)}
          >
            <WrapText size={12} strokeWidth={2.2} />
          </ToolButton>
          {lineCount > FOLD_AFTER ? (
            <ToolButton
              title={open ? "Fold" : `Show all ${lineCount} lines`}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? (
                <ChevronsDownUp size={12} strokeWidth={2.2} />
              ) : (
                <ChevronsUpDown size={12} strokeWidth={2.2} />
              )}
            </ToolButton>
          ) : null}
          <ToolButton
            title={`Save as ${fileName(title, language)}`}
            onClick={() => downloadFile(fileName(title, language), `${source}\n`, "text/plain")}
          >
            <Download size={12} strokeWidth={2.2} />
          </ToolButton>
          <CopyButton text={source} title="Copy code" />
        </>
      }
    >
      <div className="relative">
        <pre
          className="code-lines"
          data-numbers={showNumbers ? "" : undefined}
          data-wrap={wrap ? "" : undefined}
          style={
            {
              "--gutter": `${String(lineCount).length}ch`,
              maxHeight: folded ? `calc(${FOLDED_LINES} * 1.65em + 12px)` : undefined,
              overflowY: folded ? "hidden" : undefined,
            } as CSSProperties
          }
        >
          {children}
        </pre>
        {folded ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-inset from-35% to-transparent pb-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Show all {lineCount} lines
          </button>
        ) : null}
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * An SVG an assistant wrote out as code, shown as the picture it describes.
 *
 * It goes into an `<img>` through a data URL. That is the one way of showing
 * SVG where the browser refuses to run its scripts or fetch anything it links
 * to, which is exactly the treatment a drawing from a stranger should get.
 */
export function SvgBlock({ source, children }: { source: string; children?: ReactNode }) {
  const [view, setView] = useState<"picture" | "code">("picture");
  const [broken, setBroken] = useState(false);
  const url = useMemo(() => {
    // Without a namespace an SVG is not an image, only markup that looks like one.
    const svg = /\sxmlns=/.test(source)
      ? source
      : source.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [source]);

  const showCode = view === "code" || broken;

  return (
    <Frame
      label="svg"
      detail={broken ? "could not be drawn" : undefined}
      actions={
        <>
          {!broken ? (
            <ToolButton
              title={showCode ? "Show the drawing" : "Show the code"}
              onClick={() => setView(showCode ? "picture" : "code")}
            >
              {showCode ? <Eye size={12} strokeWidth={2.2} /> : <Code2 size={12} strokeWidth={2.2} />}
            </ToolButton>
          ) : null}
          <ToolButton
            title="Save as drawing.svg"
            onClick={() => downloadFile("drawing.svg", source, "image/svg+xml")}
          >
            <Download size={12} strokeWidth={2.2} />
          </ToolButton>
          <CopyButton text={source} title="Copy code" />
        </>
      }
    >
      {showCode ? (
        <pre className={cn("code-lines")}>{children}</pre>
      ) : (
        <div className="flex justify-center bg-surface p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL has nothing to optimise */}
          <img
            src={url}
            alt="Drawing from the answer"
            onError={() => setBroken(true)}
            className="!rounded-none !shadow-none max-h-[70vh] w-auto max-w-full"
          />
        </div>
      )}
    </Frame>
  );
}
