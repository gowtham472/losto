/**
 * Shared renderer behind every `opengraph-image.tsx` / `twitter-image.tsx`
 * route in the app. Kept out of the `app/` tree so the routes themselves stay
 * one-liners and the visual design lives in exactly one place.
 *
 * The backdrop is a real SVG - soft blurred light petals fanning up through an
 * azure gradient, crossed by thin white circle arcs - because Satori's CSS
 * subset cannot draw feathered light or stroked curves, while the rasterizer
 * underneath it renders SVG filters faithfully. The same geometry appears on
 * the marketing page (components/Marketing.tsx), so the card people see in a
 * chat matches the page they land on.
 */
import type { ReactElement } from "react";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_IMAGE_CONTENT_TYPE = "image/png" as const;

/* The sky. Encoded once at module load, not per request. */
const SKY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#4fb3f7"/>
      <stop offset="0.5" stop-color="#1f8ef5"/>
      <stop offset="1" stop-color="#0f6fe8"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.16" cy="0.02" r="0.9">
      <stop offset="0" stop-color="#9adcfc" stop-opacity="0.85"/>
      <stop offset="0.55" stop-color="#9adcfc" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="38"/>
    </filter>
    <filter id="softer" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="90"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#base)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g filter="url(#softer)">
    <ellipse cx="150" cy="690" rx="420" ry="260" fill="#0d5fd4" opacity="0.4"/>
  </g>

  <g filter="url(#soft)">
    <ellipse cx="520" cy="470" rx="42" ry="280" fill="#8fd0fb" opacity="0.8" transform="rotate(16 520 470)"/>
    <ellipse cx="620" cy="410" rx="50" ry="330" fill="#eaf8ff" opacity="0.92" transform="rotate(28 620 410)"/>
    <ellipse cx="732" cy="380" rx="58" ry="350" fill="#b3e2fd" opacity="0.88" transform="rotate(40 732 380)"/>
    <ellipse cx="850" cy="420" rx="52" ry="320" fill="#dcc8f7" opacity="0.75" transform="rotate(55 850 420)"/>
    <ellipse cx="950" cy="495" rx="56" ry="290" fill="#c5e9fc" opacity="0.7" transform="rotate(68 950 495)"/>
  </g>

  <g fill="none" stroke="#ffffff" stroke-width="1.6">
    <line x1="0" y1="190" x2="1200" y2="190" opacity="0.9"/>
    <circle cx="1010" cy="935" r="555" opacity="0.85"/>
    <circle cx="1195" cy="255" r="425" opacity="0.7"/>
    <circle cx="105" cy="905" r="520" opacity="0.6"/>
    <circle cx="585" cy="-330" r="610" opacity="0.5"/>
    <circle cx="1240" cy="780" r="300" opacity="0.45"/>
  </g>
</svg>`;

const SKY_URI = `data:image/svg+xml,${encodeURIComponent(SKY_SVG)}`;

export function renderOgImage({
  title,
  subtitle,
}: {
  /** The big line - usually just the app's name. */
  title: string;
  /** One quiet line under it, or nothing at all. */
  subtitle?: string;
}): ReactElement {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        backgroundImage: `url("${SKY_URI}")`,
        backgroundSize: "1200px 630px",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: title.length > 12 ? 72 : 108,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.05,
          letterSpacing: title.length > 12 ? -2 : -3,
          maxWidth: 900,
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 27,
            fontWeight: 500,
            color: "#ffffff",
            opacity: 0.92,
            lineHeight: 1.4,
            maxWidth: 760,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
