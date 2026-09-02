/**
 * Shared renderer behind every `opengraph-image.tsx` / `twitter-image.tsx`
 * route in the app. Kept out of the `app/` tree so the routes themselves stay
 * one-liners and the visual design lives in exactly one place.
 *
 * Colours are hardcoded hex, not the app's OKLCH tokens - Satori (the engine
 * behind `next/og`) does not resolve CSS variables or every color function,
 * so these are fixed equivalents of the dark-theme palette in globals.css.
 */
import type { ReactElement } from "react";

const BG_TOP = "#20222a";
const BG_BOTTOM = "#101116";
const ACCENT = "#3b82f6";
const INK = "#f6f7f9";
const INK_2 = "#a5abb8";
const GREEN = "#3ecf6e";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = "image/png" as const;

export function renderOgImage({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}): ReactElement {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 84px",
        background: `linear-gradient(135deg, ${BG_TOP} 0%, ${BG_BOTTOM} 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -160,
          right: -120,
          width: 460,
          height: 460,
          borderRadius: 9999,
          background: ACCENT,
          opacity: 0.18,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 15,
            background: ACCENT,
            color: "#ffffff",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          L
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
          Losto
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 600,
            color: ACCENT,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 20,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 58,
            fontWeight: 700,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: -1.5,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: INK_2, lineHeight: 1.45, marginTop: 22 }}>
          {subtitle}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, color: INK_2 }}>
        <div style={{ display: "flex", width: 9, height: 9, borderRadius: 9999, background: GREEN }} />
        <div style={{ display: "flex" }}>Works offline · No account · Nothing uploaded</div>
      </div>
    </div>
  );
}
