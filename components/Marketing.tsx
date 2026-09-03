/**
 * Drawings for the landing page.
 *
 * Each one shows something the app actually does, drawn to the proportions of
 * the thing it depicts: a phone is a phone, a QR code has real finder squares,
 * a signal meter loses its bars in the order a signal meter loses them. Nothing
 * here is abstract shapes for texture - if a graphic is not explaining a
 * feature it should not be on the page.
 *
 * All motion is CSS, declared in globals.css, and stops for anyone who has
 * asked their system to stop moving things.
 */

/* -------------------------------------------------------------------------- */
/* shared phone shell                                                         */
/* -------------------------------------------------------------------------- */

/** The handset every screenshot below sits inside. 9:19.5, like a real one. */
function Handset({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <g className={className}>
      {/* body, then the screen inset a bezel's width inside it */}
      <rect x="0" y="0" width="180" height="390" rx="30" fill="#0a0a0a" />
      <rect
        x="0.75"
        y="0.75"
        width="178.5"
        height="388.5"
        rx="29.25"
        fill="none"
        stroke="oklch(100% 0 0 / 0.18)"
        strokeWidth="1.5"
      />
      <rect x="6" y="6" width="168" height="378" rx="25" fill="var(--page)" />
      {/* dynamic island */}
      <rect x="72" y="13" width="36" height="10" rx="5" fill="#000" />
      <g clipPath="url(#screen-clip)">{children}</g>
    </g>
  );
}

function ScreenClip() {
  return (
    <defs>
      <clipPath id="screen-clip">
        <rect x="6" y="6" width="168" height="378" rx="25" />
      </clipPath>
    </defs>
  );
}

/** The signal meter in the status bar, which drops out and stays out. */
function SignalBars({ x, y }: { x: number; y: number }) {
  const bars = [3, 5, 7, 9];
  return (
    <g transform={`translate(${x} ${y})`}>
      {bars.map((h, i) => (
        <rect
          key={h}
          x={i * 4}
          y={9 - h}
          width="2.5"
          height={h}
          rx="1"
          fill="var(--ink)"
          className="animate-bars"
          // The tallest bar goes first, the way a real meter empties.
          style={{ animationDelay: `${(bars.length - i) * 0.14}s` }}
        />
      ))}
    </g>
  );
}

/** One library row: source tile, two title lines, a progress bar. */
function Row({ y, width, progress, tint }: { y: number; width: number; progress: number; tint: string }) {
  return (
    <g transform={`translate(18 ${y})`}>
      <rect x="0" y="0" width="144" height="46" rx="9" fill="var(--surface)" />
      <rect
        x="0.5"
        y="0.5"
        width="143"
        height="45"
        rx="8.5"
        fill="none"
        stroke="oklch(100% 0 0 / 0.07)"
      />
      <rect x="8" y="9" width="14" height="14" rx="4" fill={tint} opacity="0.9" />
      <rect x="28" y="10" width={width} height="4.5" rx="2.25" fill="var(--ink)" opacity="0.72" />
      <rect x="28" y="19" width={width * 0.62} height="4" rx="2" fill="var(--ink)" opacity="0.3" />
      <rect x="8" y="33" width="128" height="3" rx="1.5" fill="oklch(100% 0 0 / 0.09)" />
      <rect x="8" y="33" width={128 * progress} height="3" rx="1.5" fill={tint} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. it keeps working when the signal does not                               */
/* -------------------------------------------------------------------------- */

export function OfflineArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 390"
      className={className}
      role="img"
      aria-label="A phone with no signal, still showing a full library of saved chats"
    >
      <ScreenClip />
      <Handset>
        {/* status bar - the signal drops, the battery stays */}
        <text x="18" y="30" fill="var(--ink)" fontSize="9" fontWeight="600" fontFamily="inherit">
          9:41
        </text>
        <SignalBars x={128} y={22} />
        <rect
          x="150"
          y="22"
          width="14"
          height="8"
          rx="2.5"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1"
          opacity="0.75"
        />
        <rect x="151.5" y="23.5" width="9" height="5" rx="1.5" fill="var(--ink)" opacity="0.75" />

        {/* the offline pill, which is the point of the whole picture */}
        <g className="animate-bars" style={{ animationDirection: "reverse" }}>
          <rect x="18" y="44" width="70" height="17" rx="8.5" fill="var(--accent-tint)" />
          <circle cx="28" cy="52.5" r="2.5" fill="var(--accent)" />
          <text x="35" y="56" fill="var(--accent-ink)" fontSize="8" fontWeight="600" fontFamily="inherit">
            No signal
          </text>
        </g>

        <text x="18" y="82" fill="var(--ink)" fontSize="13" fontWeight="700" fontFamily="inherit">
          Library
        </text>

        <Row y={94} width={78} progress={0.97} tint="var(--brand-chatgpt)" />
        <Row y={146} width={66} progress={0.52} tint="var(--brand-claude)" />
        <Row y={198} width={84} progress={0.28} tint="var(--brand-gemini)" />
        <Row y={250} width={58} progress={0.74} tint="var(--brand-perplexity)" />
        <Row y={302} width={72} progress={0.11} tint="var(--brand-manual)" />
      </Handset>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. one turn becomes a checklist                                            */
/* -------------------------------------------------------------------------- */

const CHECKS = [
  { label: 76, done: true },
  { label: 92, done: true },
  { label: 64, done: true },
  { label: 84, done: false },
  { label: 70, done: false },
];

export function ChecklistArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 180"
      className={className}
      role="img"
      aria-label="A single answer being split into a checklist of separate questions"
    >
      {/* the one message it all came from */}
      <rect x="0" y="8" width="96" height="112" rx="10" fill="var(--surface)" />
      <rect x="0.5" y="8.5" width="95" height="111" rx="9.5" fill="none" stroke="oklch(100% 0 0 / 0.08)" />
      <text x="12" y="28" fill="var(--ink-3)" fontSize="7.5" fontWeight="600" fontFamily="inherit">
        ONE ANSWER
      </text>
      {[38, 48, 58, 68, 78, 88, 98, 108].map((y, i) => (
        <rect
          key={y}
          x="12"
          y={y}
          width={i % 3 === 0 ? 62 : 72}
          height="3.5"
          rx="1.75"
          fill="var(--ink)"
          opacity="0.22"
        />
      ))}

      {/* the split, drawn rather than implied */}
      {CHECKS.map((_, i) => {
        const y = 26 + i * 32;
        return (
          <path
            key={y}
            d={`M96 64 C 118 64, 118 ${y}, 140 ${y}`}
            fill="none"
            stroke="oklch(100% 0 0 / 0.22)"
            strokeWidth="1.25"
            strokeDasharray="150"
            className="animate-draw"
            style={{ ["--draw-length" as string]: "150", animationDelay: `${i * 0.12}s` }}
          />
        );
      })}

      {/* the checklist it turns into */}
      {CHECKS.map((row, i) => {
        const y = 26 + i * 32;
        return (
          <g key={y} transform={`translate(140 ${y - 11})`}>
            <rect
              x="0"
              y="0"
              width="120"
              height="22"
              rx="6"
              fill={row.done ? "var(--green-tint)" : "var(--surface)"}
            />
            <rect
              x="6"
              y="6"
              width="10"
              height="10"
              rx="3"
              fill={row.done ? "var(--green)" : "none"}
              stroke={row.done ? "none" : "oklch(100% 0 0 / 0.22)"}
              strokeWidth="1.25"
            />
            {row.done ? (
              <path
                d="M8.4 11.2 L10.2 13 L13.8 9"
                fill="none"
                stroke="#04120a"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="22"
                className="animate-tick"
                style={{ animationDelay: `${i * 0.22}s` }}
              />
            ) : null}
            <rect
              x="24"
              y="9"
              width={row.label}
              height="4"
              rx="2"
              fill="var(--ink)"
              opacity={row.done ? 0.4 : 0.6}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. handing a chat to the phone next to you                                 */
/* -------------------------------------------------------------------------- */

/**
 * A 21×21 code with real finder squares, a timing track and a fixed data field.
 * Fixed rather than random so the server and the browser draw the same thing.
 */
function qrModules(): boolean[][] {
  const size = 21;
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) grid[oy + y][ox + x] = true;
      }
    }
  };
  finder(0, 0);
  finder(14, 0);
  finder(0, 14);

  // Timing tracks, then a deterministic data field that reads as noise.
  for (let i = 8; i < 13; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }
  let seed = 0x5eed;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inFinder =
        (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12) || x === 6 || y === 6;
      if (inFinder) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      grid[y][x] = ((seed >> 16) & 1) === 1;
    }
  }
  return grid;
}

const QR = qrModules();

export function HandoffArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 200"
      className={className}
      role="img"
      aria-label="One phone showing a code and another scanning it, with no network between them"
    >
      <defs>
        <clipPath id="handoff-left">
          <rect x="14" y="18" width="88" height="164" rx="14" />
        </clipPath>
        <clipPath id="handoff-right">
          <rect x="198" y="18" width="88" height="164" rx="14" />
        </clipPath>
      </defs>

      {/* sender */}
      <rect x="10" y="14" width="96" height="172" rx="18" fill="#0a0a0a" />
      <rect
        x="10.75"
        y="14.75"
        width="94.5"
        height="170.5"
        rx="17.25"
        fill="none"
        stroke="oklch(100% 0 0 / 0.16)"
        strokeWidth="1.5"
      />
      <rect x="14" y="18" width="88" height="164" rx="14" fill="var(--page)" />
      <g clipPath="url(#handoff-left)">
        <rect x="26" y="42" width="64" height="64" rx="6" fill="#fff" />
        {QR.map((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect
                key={`${x}-${y}`}
                x={29 + x * 2.75}
                y={45 + y * 2.75}
                width="2.75"
                height="2.75"
                fill="#000"
              />
            ) : null,
          ),
        )}
        <text x="58" y="126" fill="var(--ink)" fontSize="11" fontWeight="700" textAnchor="middle" fontFamily="inherit">
          4820 193
        </text>
        <text x="58" y="141" fill="var(--ink-3)" fontSize="7" textAnchor="middle" fontFamily="inherit">
          read this out
        </text>
      </g>

      {/* what passes between them: no tower, no cable, just the two of them */}
      <path
        id="handoff-path"
        d="M112 100 C 140 74, 168 74, 194 100"
        fill="none"
        stroke="oklch(100% 0 0 / 0.2)"
        strokeWidth="1.25"
        strokeDasharray="4 5"
      />
      {[0, 1, 2].map((i) => (
        <circle
          key={i}
          r="2.75"
          fill="var(--accent)"
          className="animate-travel"
          style={{
            offsetPath: 'path("M112 100 C 140 74, 168 74, 194 100")',
            animationDelay: `${i}s`,
          }}
        />
      ))}
      <text x="153" y="126" fill="var(--ink-3)" fontSize="7.5" textAnchor="middle" fontFamily="inherit">
        no internet
      </text>

      {/* receiver, mid-scan */}
      <rect x="194" y="14" width="96" height="172" rx="18" fill="#0a0a0a" />
      <rect
        x="194.75"
        y="14.75"
        width="94.5"
        height="170.5"
        rx="17.25"
        fill="none"
        stroke="oklch(100% 0 0 / 0.16)"
        strokeWidth="1.5"
      />
      <rect x="198" y="18" width="88" height="164" rx="14" fill="var(--page)" />
      <g clipPath="url(#handoff-right)">
        <rect x="210" y="42" width="64" height="64" rx="8" fill="oklch(100% 0 0 / 0.04)" />
        {/* viewfinder corners */}
        {[
          "M214 54 L214 46 L222 46",
          "M270 54 L270 46 L262 46",
          "M214 94 L214 102 L222 102",
          "M270 94 L270 102 L262 102",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" />
        ))}
        <rect
          x="214"
          y="48"
          width="56"
          height="1.5"
          rx="0.75"
          fill="var(--accent)"
          className="animate-scan"
          style={{ ["--scan-distance" as string]: "52px" }}
        />
        <rect x="210" y="118" width="64" height="4" rx="2" fill="oklch(100% 0 0 / 0.1)" />
        <rect x="210" y="118" width="41" height="4" rx="2" fill="var(--green)" />
        <text x="242" y="137" fill="var(--ink-2)" fontSize="7.5" textAnchor="middle" fontFamily="inherit">
          5 of 8 pieces
        </text>
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* the sky                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The decor that turns a `.marketing-sky` panel into the sky on the social
 * card: thin white circle arcs, and soft petals of light fanning up through
 * the blue. Same geometry as lib/og-image.tsx, kept in step by eye.
 *
 * Everything here is aria-hidden decoration behind real content, absolutely
 * positioned, and clipped by whichever panel it sits in.
 */
export function Sky({ dim }: { dim?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* petals of light, blurred well past their own size */}
      <div
        className="animate-drift absolute left-[38%] top-[18%] h-[130%] w-[9%] rounded-full blur-[60px]"
        style={{ background: "oklch(97% 0.02 235)", opacity: dim ? 0.35 : 0.65, rotate: "24deg" }}
      />
      <div
        className="animate-drift absolute left-[52%] top-[8%] h-[150%] w-[11%] rounded-full blur-[70px]"
        style={{
          background: "oklch(98% 0.015 240)",
          opacity: dim ? 0.32 : 0.6,
          rotate: "38deg",
          animationDelay: "-5s",
        }}
      />
      <div
        className="animate-drift absolute left-[66%] top-[14%] h-[130%] w-[10%] rounded-full blur-[65px]"
        style={{
          background: "oklch(93% 0.04 300)",
          opacity: dim ? 0.26 : 0.5,
          rotate: "52deg",
          animationDelay: "-9s",
        }}
      />

      {/* the thin white lines */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1200 630"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
      >
        <line x1="-100" y1="190" x2="1300" y2="190" opacity={dim ? 0.4 : 0.6} vectorEffect="non-scaling-stroke" />
        <circle cx="1010" cy="935" r="555" opacity={dim ? 0.35 : 0.55} vectorEffect="non-scaling-stroke" />
        <circle cx="1195" cy="255" r="425" opacity={dim ? 0.28 : 0.45} vectorEffect="non-scaling-stroke" />
        <circle cx="105" cy="905" r="520" opacity={dim ? 0.24 : 0.4} vectorEffect="non-scaling-stroke" />
        <circle cx="585" cy="-330" r="610" opacity={dim ? 0.2 : 0.35} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
