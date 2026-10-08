/**
 * Drawing Mermaid diagrams, offline.
 *
 * Mermaid is large (about 1.3 MB compressed) and loads each diagram type as a
 * separate chunk when imported the usual way. That is the wrong shape for this
 * app: a chunk for a diagram type nobody has drawn yet would not be in the
 * offline cache, and the first sequence diagram opened on a train would fail.
 *
 * So the single-file build is copied to `public/vendor/` by next.config.ts and
 * loaded with a script tag. One URL, fetched once, holding every diagram type -
 * the service worker caches it in the background after the first online visit,
 * and nothing is paid for it by a page that never shows a diagram.
 *
 * Diagrams are parsed with `securityLevel: "strict"`, which runs Mermaid's own
 * output through DOMPurify and disables click handlers in the source.
 */
import type { Mermaid } from "mermaid";

export const MERMAID_URL = `/vendor/mermaid-${process.env.NEXT_PUBLIC_MERMAID_VERSION}.min.js`;

export class DiagramProblem extends Error {
  constructor(
    /** `unavailable`: the renderer could not be loaded. `syntax`: it could, and said no. */
    public kind: "unavailable" | "syntax",
    message: string,
  ) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* recognising a diagram that was not labelled as one                         */
/* -------------------------------------------------------------------------- */

const OPENERS =
  /^(?:(?:graph|flowchart)\s+(?:TB|TD|BT|RL|LR)\b|(?:sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|gantt|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\s*$|pie(?:\s+showData)?(?:\s+title\b.*)?\s*$)/;

/**
 * True when an unlabelled fence opens the way a Mermaid diagram does. The
 * opening keyword has to stand as the first real line, so prose that merely
 * mentions a "graph" is not mistaken for one.
 */
export function looksLikeMermaid(code: string): boolean {
  const lines = code.split(/\r\n|\r|\n/).map((line) => line.trim());
  let i = 0;
  // Front matter and directives are allowed before the diagram itself.
  if (lines[i] === "---") {
    i = lines.indexOf("---", 1) + 1;
    if (i === 0) return false;
  }
  while (i < lines.length && (!lines[i] || lines[i].startsWith("%%"))) i++;
  return i < lines.length && lines.length - i > 1 && OPENERS.test(lines[i]);
}

/* -------------------------------------------------------------------------- */
/* loading                                                                    */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    mermaid?: Mermaid;
  }
}

let loading: Promise<Mermaid> | null = null;

function load(): Promise<Mermaid> {
  if (window.mermaid) return Promise.resolve(window.mermaid);

  loading ??= new Promise<Mermaid>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MERMAID_URL;
    script.async = true;
    script.onload = () => {
      if (window.mermaid) resolve(window.mermaid);
      else reject(new DiagramProblem("unavailable", "The diagram renderer did not start."));
    };
    script.onerror = () => {
      script.remove();
      // Forget the attempt, so the next diagram tries again once back online.
      loading = null;
      reject(
        new DiagramProblem(
          "unavailable",
          "The diagram renderer is not on this device yet. Open Losto once with a connection and it is kept for good.",
        ),
      );
    };
    document.head.appendChild(script);
  });
  return loading;
}

/* -------------------------------------------------------------------------- */
/* theming                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mermaid derives its palette by doing arithmetic on colours, and its parser
 * predates OKLCH - handed one of the app's tokens it gives up and draws black.
 * Each token is therefore painted onto a canvas and read back as sRGB, over the
 * surface colour so the translucent dark-theme tints come out opaque.
 */
function tokenReader(scope: Element) {
  const style = getComputedStyle(scope);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const paint = (value: string) => {
    if (!ctx || !value) return;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
  };

  return (name: string, over = "--surface"): string => {
    if (!ctx) return "#888888";
    ctx.clearRect(0, 0, 1, 1);
    paint(style.getPropertyValue(over).trim());
    paint(style.getPropertyValue(name).trim());
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };
}

/** A font the canvas has too, so an exported PNG is laid out like the screen. */
const DIAGRAM_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function themeVariables(dark: boolean) {
  const token = tokenReader(document.documentElement);

  const surface = token("--surface");
  const inset = token("--inset");
  const ink = token("--ink");
  const ink2 = token("--ink-2");
  const ink3 = token("--ink-3");
  const line = token("--line-strong");
  const accent = token("--accent");

  const hues = ["--accent", "--green", "--orange", "--violet", "--red"];
  const solids = hues.map((name) => token(name));
  const tints = hues.map((name) => token(`${name}-tint`));

  const variables: Record<string, string | boolean> = {
    darkMode: dark,
    fontFamily: DIAGRAM_FONT,
    fontSize: "14px",

    background: surface,
    mainBkg: tints[0],
    primaryColor: tints[0],
    primaryTextColor: ink,
    primaryBorderColor: accent,
    secondaryColor: tints[1],
    secondaryTextColor: ink,
    secondaryBorderColor: solids[1],
    tertiaryColor: inset,
    tertiaryTextColor: ink,
    tertiaryBorderColor: line,

    textColor: ink,
    titleColor: ink,
    lineColor: ink3,
    nodeBorder: accent,
    nodeTextColor: ink,
    clusterBkg: inset,
    clusterBorder: line,
    edgeLabelBackground: surface,
    defaultLinkColor: ink3,

    // sequence
    actorBkg: tints[0],
    actorBorder: accent,
    actorTextColor: ink,
    actorLineColor: ink3,
    signalColor: ink2,
    signalTextColor: ink,
    labelBoxBkgColor: inset,
    labelBoxBorderColor: line,
    labelTextColor: ink,
    loopTextColor: ink2,
    noteBkgColor: tints[2],
    noteBorderColor: solids[2],
    noteTextColor: ink,
    activationBkgColor: inset,
    activationBorderColor: ink3,
    sequenceNumberColor: surface,

    // state and class
    labelColor: ink,
    altBackground: inset,
    classText: ink,

    // gantt
    sectionBkgColor: inset,
    altSectionBkgColor: surface,
    sectionBkgColor2: tints[1],
    gridColor: line,
    taskBkgColor: tints[0],
    taskBorderColor: accent,
    taskTextColor: ink,
    taskTextDarkColor: ink,
    taskTextOutsideColor: ink2,
    activeTaskBkgColor: tints[2],
    activeTaskBorderColor: solids[2],
    doneTaskBkgColor: inset,
    doneTaskBorderColor: ink3,
    critBkgColor: tints[4],
    critBorderColor: solids[4],
    todayLineColor: solids[4],

    // er and requirement
    attributeBackgroundColorOdd: surface,
    attributeBackgroundColorEven: inset,

    // pie
    pieTitleTextColor: ink,
    pieSectionTextColor: surface,
    pieLegendTextColor: ink,
    pieStrokeColor: surface,
    pieOuterStrokeColor: line,
    pieOpacity: "1",

    // quadrant and xy charts
    quadrant1Fill: tints[0],
    quadrant2Fill: tints[1],
    quadrant3Fill: inset,
    quadrant4Fill: tints[2],
    quadrantPointFill: accent,
    quadrantTitleFill: ink,
    quadrantExternalBorderStrokeFill: line,
    quadrantInternalBorderStrokeFill: line,
  };

  // Mind maps, timelines, journeys, git graphs and pies all draw from a scale.
  for (let i = 0; i < 12; i++) {
    variables[`pie${i + 1}`] = solids[i % solids.length];
    variables[`git${i}`] = solids[i % solids.length];
    variables[`cScale${i}`] = tints[i % tints.length];
    variables[`cScaleLabel${i}`] = ink;
    variables[`cScalePeer${i}`] = solids[i % solids.length];
    variables[`fillType${i}`] = tints[i % tints.length];
  }
  return variables;
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                  */
/* -------------------------------------------------------------------------- */

export interface Drawing {
  svg: string;
  width: number;
  height: number;
}

/** Finished drawings, so scrolling a long chat back and forth draws each once. */
const drawn = new Map<string, Drawing>();
const DRAWN_LIMIT = 80;

/** Mermaid keeps global state while it lays a diagram out; one at a time. */
let queue: Promise<unknown> = Promise.resolve();
let configuredFor = "";
let serial = 0;

function measure(svg: string): { width: number; height: number } {
  const box = svg.match(/viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
  return { width: Number(box?.[1]) || 600, height: Number(box?.[2]) || 400 };
}

/**
 * What went wrong, for a reader rather than a grammar author. Mermaid's own
 * message lists every token it would have accepted; the line number is the part
 * anyone can use.
 */
function readable(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const line = message.match(/error on line (\d+)/i)?.[1];
  if (line) return `Mermaid could not read line ${line} of this diagram, so its source is shown instead.`;
  if (/no diagram type detected/i.test(message)) {
    return "This does not start like any diagram Mermaid knows, so its source is shown instead.";
  }
  return "Mermaid could not draw this diagram, so its source is shown instead.";
}

/**
 * Draws one diagram for one theme. `theme` is only a cache key and a light/dark
 * flag - the colours themselves are read from the page at the time of drawing.
 */
export function renderDiagram(code: string, theme: "light" | "dark"): Promise<Drawing> {
  const key = `${theme}\n${code}`;
  const cached = drawn.get(key);
  if (cached) return Promise.resolve(cached);

  const task = queue.then(async () => {
    const mermaid = await load();

    if (configuredFor !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        suppressErrorRendering: true,
        // SVG text rather than embedded HTML: it survives export to PNG, and
        // opens in anything that reads SVG.
        htmlLabels: false,
        theme: "base",
        // Flat boxes. The newer default look puts a soft glow behind every node.
        look: "classic",
        themeVariables: themeVariables(theme === "dark"),
        fontFamily: DIAGRAM_FONT,
      });
      configuredFor = theme;
    }

    const id = `losto-diagram-${++serial}`;
    try {
      const { svg } = await mermaid.render(id, code.trim());
      const drawing = { svg, ...measure(svg) };
      if (drawn.size >= DRAWN_LIMIT) drawn.delete(drawn.keys().next().value!);
      drawn.set(key, drawing);
      return drawing;
    } catch (error) {
      throw new DiagramProblem("syntax", readable(error));
    } finally {
      // A failed layout leaves its scratch element behind in the body.
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
    }
  });

  // A failure belongs to its own caller; the queue itself carries on.
  queue = task.catch(() => {});
  return task;
}

/* -------------------------------------------------------------------------- */
/* export                                                                     */
/* -------------------------------------------------------------------------- */

/** A standalone SVG file: namespaced, sized, and with its own background. */
export function standaloneSvg(drawing: Drawing, background: string): string {
  const pad = 16;
  const width = Math.ceil(drawing.width + pad * 2);
  const height = Math.ceil(drawing.height + pad * 2);
  const inner = drawing.svg
    .replace(/^<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"')
    .replace(/\sstyle="[^"]*max-width[^"]*"/, "")
    .replace(/^<svg\b([^>]*?)\swidth="[^"]*"/, "<svg$1")
    .replace(/^<svg\b/, `<svg x="${pad}" y="${pad}" width="${drawing.width}" height="${drawing.height}"`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="100%" height="100%" fill="${background}"/>${inner}</svg>`
  );
}

/** Rasterises a standalone SVG. Twice the size, capped so a phone can hold it. */
export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const image = new Image();
  image.decoding = "async";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Empty image"))), "image/png"),
  );
}

/** The page's surface colour as sRGB, for an export's background. */
export function surfaceColour(): string {
  return tokenReader(document.documentElement)("--surface");
}
