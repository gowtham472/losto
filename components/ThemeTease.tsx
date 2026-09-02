"use client";

import { Palette } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The colour themes are not built yet, so this does not pretend to sign anyone
 * up for them. It shows one instead: tapping it repaints the page's accent, and
 * the page keeps that colour until it is tapped back to grey. A button that
 * collected an email for a feature with no ship date would be worth less than
 * a button that just shows you the feature.
 */
const THEMES = [
  { name: "Slate", accent: "68% 0.173 253.301", ink: "78.8% 0.113 248.33" },
  { name: "Ember", accent: "70% 0.19 40", ink: "80% 0.13 45" },
  { name: "Moss", accent: "70% 0.16 155", ink: "80% 0.11 158" },
  { name: "Iris", accent: "66% 0.2 295", ink: "78% 0.14 293" },
  { name: "Rose", accent: "68% 0.2 15", ink: "79% 0.13 18" },
] as const;

export function ThemeTease() {
  const [index, setIndex] = useState(0);
  const anchor = useRef<HTMLButtonElement>(null);

  const paint = useCallback((next: number) => {
    const root = anchor.current?.closest<HTMLElement>('[data-surface="marketing"]');
    if (!root) return;
    const theme = THEMES[next];
    root.style.setProperty("--accent", `oklch(${theme.accent})`);
    root.style.setProperty("--accent-ink", `oklch(${theme.ink})`);
    root.style.setProperty("--accent-tint", `oklch(${theme.accent} / 0.16)`);
  }, []);

  // The colour lives on the page element, so it has to come back off again if
  // this ever unmounts underneath a client-side navigation.
  useEffect(() => {
    const root = anchor.current?.closest<HTMLElement>('[data-surface="marketing"]');
    return () => {
      root?.style.removeProperty("--accent");
      root?.style.removeProperty("--accent-ink");
      root?.style.removeProperty("--accent-tint");
    };
  }, []);

  const theme = THEMES[index];

  return (
    <button
      ref={anchor}
      type="button"
      onClick={() => {
        const next = (index + 1) % THEMES.length;
        setIndex(next);
        paint(next);
      }}
      className="group inline-flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-3.5 text-[12px] font-medium text-ink-2 shadow-hairline transition-colors hover:bg-hover hover:text-ink"
    >
      <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full">
        <span
          aria-hidden
          className="animate-hue absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(70% 0.19 40), oklch(70% 0.16 155), oklch(68% 0.173 253), oklch(66% 0.2 295), oklch(68% 0.2 15), oklch(70% 0.19 40))",
          }}
        />
        <Palette size={12} strokeWidth={2.4} className="relative text-black/70" />
      </span>
      <span>
        {index === 0 ? (
          <>
            Colour themes are coming
            <span className="ml-1.5 text-ink-3 group-hover:text-ink-2">have a look</span>
          </>
        ) : (
          <>
            {theme.name}
            <span className="ml-1.5 text-ink-3 group-hover:text-ink-2">tap for another</span>
          </>
        )}
      </span>
    </button>
  );
}
