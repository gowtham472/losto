"use client";

import { Code2, Download, Eye, ImageDown, Maximize2, Minus, Plus, RotateCw, Scan, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  DiagramProblem,
  renderDiagram,
  standaloneSvg,
  surfaceColour,
  svgToPng,
  type Drawing,
} from "@/lib/mermaid";
import { cn, downloadBlob, downloadFile } from "@/lib/utils";
import { CopyButton, Frame, ToolButton, useTheme } from "./Frame";

type State =
  | { status: "waiting" }
  | { status: "drawn"; drawing: Drawing }
  | { status: "failed"; problem: DiagramProblem };

/** The kind of diagram, read off its opening keyword, for the label. */
function diagramKind(code: string): string {
  const opener = code
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("%%") && line !== "---" && !/^\w+:/.test(line));
  const word = opener?.match(/^[A-Za-z0-9]+/)?.[0] ?? "";
  return (
    {
      graph: "flowchart",
      flowchart: "flowchart",
      sequenceDiagram: "sequence",
      classDiagram: "class",
      stateDiagram: "state",
      erDiagram: "entity relationship",
      gantt: "gantt",
      pie: "pie",
      mindmap: "mind map",
      timeline: "timeline",
      gitGraph: "git graph",
      journey: "journey",
      quadrantChart: "quadrant",
      xychart: "chart",
      sankey: "sankey",
      requirementDiagram: "requirements",
    }[word] ?? "diagram"
  );
}

function saveSvg(drawing: Drawing) {
  downloadFile("diagram.svg", standaloneSvg(drawing, surfaceColour()), "image/svg+xml");
}

async function savePng(drawing: Drawing) {
  const svg = standaloneSvg(drawing, surfaceColour());
  const blob = await svgToPng(svg, drawing.width + 32, drawing.height + 32);
  downloadBlob("diagram.png", blob);
}

/**
 * A Mermaid fence, drawn.
 *
 * Nothing is loaded or laid out until the block is near the screen - a saved
 * chat can hold dozens of these and the reader may only ever scroll past three.
 * If the diagram cannot be drawn the source is shown instead, with the reason,
 * because the text of a flowchart is still most of a flowchart.
 */
export function Diagram({ code }: { code: string }) {
  const theme = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<State>({ status: "waiting" });
  const [view, setView] = useState<"diagram" | "code">("diagram");
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = host.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let stale = false;
    renderDiagram(code, theme).then(
      (drawing) => {
        if (!stale) setState({ status: "drawn", drawing });
      },
      (error: unknown) => {
        if (stale) return;
        const problem =
          error instanceof DiagramProblem
            ? error
            : new DiagramProblem("syntax", "The diagram could not be drawn.");
        setState({ status: "failed", problem });
      },
    );
    return () => {
      stale = true;
    };
  }, [near, code, theme, attempt]);

  const drawing = state.status === "drawn" ? state.drawing : null;
  const failed = state.status === "failed" ? state.problem : null;
  const showCode = view === "code" || Boolean(failed);

  return (
    <div ref={host}>
      <Frame
        label={diagramKind(code)}
        detail={failed ? (failed.kind === "syntax" ? "could not be drawn" : "not drawn yet") : undefined}
        actions={
          <>
            {failed?.kind === "unavailable" ? (
              <ToolButton
                title="Try again"
                onClick={() => {
                  setState({ status: "waiting" });
                  setAttempt((n) => n + 1);
                }}
              >
                <RotateCw size={12} strokeWidth={2.2} />
              </ToolButton>
            ) : null}
            {!failed ? (
              <ToolButton
                title={showCode ? "Show the diagram" : "Show the source"}
                onClick={() => setView(showCode ? "diagram" : "code")}
              >
                {showCode ? <Eye size={12} strokeWidth={2.2} /> : <Code2 size={12} strokeWidth={2.2} />}
              </ToolButton>
            ) : null}
            {drawing ? (
              <ToolButton title="Open full screen" onClick={() => setExpanded(true)}>
                <Maximize2 size={12} strokeWidth={2.2} />
              </ToolButton>
            ) : null}
            <CopyButton text={code} title="Copy diagram source" />
          </>
        }
      >
        {failed ? (
          <p className="border-b border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-ink-2">
            {failed.message}
          </p>
        ) : null}

        {showCode ? (
          <pre className="code-lines">
            <code>{code}</code>
          </pre>
        ) : drawing ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="Open full screen"
            className="losto-diagram flex w-full cursor-zoom-in justify-center bg-surface px-3 py-4"
            dangerouslySetInnerHTML={{ __html: drawing.svg }}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-surface" aria-busy="true">
            <span className="shimmer h-24 w-2/3 rounded-card" />
          </div>
        )}
      </Frame>

      {expanded && drawing ? (
        <DiagramViewer drawing={drawing} title={diagramKind(code)} onClose={() => setExpanded(false)} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* full-screen viewer                                                         */
/* -------------------------------------------------------------------------- */

interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

/**
 * The diagram on its own, to be dragged around and zoomed: wheel or pinch to
 * zoom about the pointer, drag to pan, double-tap to step in. A class diagram
 * with thirty boxes is unreadable at the width of a phone, and this is where it
 * gets read.
 */
function DiagramViewer({
  drawing,
  title,
  onClose,
}: {
  drawing: Drawing;
  title: string;
  onClose: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, k: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);

  // Written straight to the element: a drag should not re-render React per pixel.
  const apply = useCallback((next: View) => {
    view.current = next;
    if (sheet.current) {
      sheet.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.k})`;
    }
    setZoom(next.k);
  }, []);

  const fit = useCallback(() => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const k = clampZoom(Math.min((box.width - 32) / drawing.width, (box.height - 32) / drawing.height, 2.5));
    apply({
      k,
      x: (box.width - drawing.width * k) / 2,
      y: (box.height - drawing.height * k) / 2,
    });
  }, [apply, drawing.height, drawing.width]);

  /** Zooms by `factor`, keeping the point under (cx, cy) where it is. */
  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const box = stage.current?.getBoundingClientRect();
      if (!box) return;
      const { x, y, k } = view.current;
      const px = cx ?? box.width / 2;
      const py = cy ?? box.height / 2;
      const next = clampZoom(k * factor);
      apply({ k: next, x: px - ((px - x) * next) / k, y: py - ((py - y) * next) / k });
    },
    [apply],
  );

  useLayoutEffect(fit, [fit]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (event.key === "+" || event.key === "=") zoomAt(1.25);
      else if (event.key === "-") zoomAt(0.8);
      else if (event.key === "0") fit();
    };
    // React registers wheel listeners as passive, which cannot stop the page scrolling.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018)), event.clientX - box.left, event.clientY - box.top);
    };

    document.addEventListener("keydown", onKey, true);
    element.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", fit);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey, true);
      element.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", fit);
      document.body.style.overflow = overflow;
    };
  }, [fit, onClose, zoomAt]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const before = pointers.current.get(event.pointerId);
    if (!before) return;
    const box = event.currentTarget.getBoundingClientRect();
    const now = { x: event.clientX, y: event.clientY };

    if (pointers.current.size === 1) {
      const { x, y, k } = view.current;
      apply({ k, x: x + now.x - before.x, y: y + now.y - before.y });
    } else if (pointers.current.size === 2) {
      // Pinch: scale by how far the fingers moved apart, about their midpoint.
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const was = Math.hypot(before.x - other.x, before.y - other.y);
        const is = Math.hypot(now.x - other.x, now.y - other.y);
        if (was > 0) {
          zoomAt(is / was, (now.x + other.x) / 2 - box.left, (now.y + other.y) / 2 - box.top);
        }
      }
    }
    pointers.current.set(event.pointerId, now);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const run = async (job: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch {
      /* a failed export leaves the diagram on screen, which is the fallback */
    } finally {
      setBusy(false);
    }
  };

  const bar = "flex h-9 items-center gap-1.5 rounded-control px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-50";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} diagram`}
      className="fixed inset-0 z-[90] flex flex-col bg-page"
    >
      <div className="flex h-13 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)]">
        <span className="min-w-0 flex-1 truncate pl-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {title}
        </span>
        <button type="button" className={bar} onClick={() => zoomAt(0.8)} title="Zoom out" aria-label="Zoom out">
          <Minus size={15} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className={cn(bar, "min-w-14 justify-center tabular-nums")}
          onClick={fit}
          title="Fit to screen"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className={bar} onClick={() => zoomAt(1.25)} title="Zoom in" aria-label="Zoom in">
          <Plus size={15} strokeWidth={2.2} />
        </button>
        <button type="button" className={cn(bar, "max-sm:hidden")} onClick={fit} title="Fit to screen">
          <Scan size={15} strokeWidth={2.2} />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" className={bar} disabled={busy} onClick={() => run(() => saveSvg(drawing))} title="Save as SVG">
          <Download size={15} strokeWidth={2.2} />
          <span className="max-sm:hidden">SVG</span>
        </button>
        <button type="button" className={bar} disabled={busy} onClick={() => run(() => savePng(drawing))} title="Save as PNG">
          <ImageDown size={15} strokeWidth={2.2} />
          <span className="max-sm:hidden">PNG</span>
        </button>
        <button type="button" className={bar} onClick={onClose} title="Close" aria-label="Close">
          <X size={16} strokeWidth={2.2} />
        </button>
      </div>

      <div
        ref={stage}
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          zoomAt(1.6, event.clientX - box.left, event.clientY - box.top);
        }}
      >
        <div
          ref={sheet}
          className="losto-diagram absolute left-0 top-0 origin-top-left will-change-transform"
          style={{ width: drawing.width, height: drawing.height }}
          dangerouslySetInnerHTML={{ __html: drawing.svg }}
        />
      </div>
    </div>,
    document.body,
  );
}
