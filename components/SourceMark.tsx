"use client";

import { useEffect, useState } from "react";
import { assetObjectUrl } from "@/lib/assets";
import { bundledLogo } from "@/lib/logos";
import { sourceInfo } from "@/lib/sources";
import type { SourceId } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { box: "size-6 rounded-[6px]", text: "text-[8.5px]", pad: "p-[3px]" },
  md: { box: "size-8 rounded-[8px]", text: "text-[10px]", pad: "p-[5px]" },
  lg: { box: "size-10 rounded-[10px]", text: "text-[11.5px]", pad: "p-[6px]" },
} as const;

/**
 * Identifies where a saved item came from.
 *
 * Three things can fill the tile, in order. A mark that ships with the app,
 * for the few sources whose icon cannot be fetched reliably - it is there on
 * the first frame and needs no connection. Otherwise the icon downloaded from
 * the site at import time, which stays right through a rebrand and covers every
 * blog without bundling anything. Failing both, a tinted monogram.
 *
 * A bundled mark sits on white rather than on the surface colour: these are
 * dark shapes on transparent backgrounds, and on a dark tile in dark mode they
 * would disappear.
 */
export function SourceMark({
  source,
  sourceUrl,
  faviconId,
  size = "md",
  className,
}: {
  source: SourceId;
  /** Where the item came from, for marks matched by site rather than source. */
  sourceUrl?: string;
  /** Stored favicon asset id from the chat record. */
  faviconId?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const info = sourceInfo(source);
  const logo = bundledLogo(source, sourceUrl);
  // Tagged with the id it resolved, so a stale icon never outlives its chat.
  const [resolved, setResolved] = useState<{ id: string; url: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const dims = SIZES[size];

  useEffect(() => {
    if (!faviconId) return;
    let cancelled = false;
    assetObjectUrl(faviconId).then((url) => {
      if (!cancelled) setResolved({ id: faviconId, url });
    });
    return () => {
      cancelled = true;
    };
  }, [faviconId]);

  const icon = resolved && resolved.id === faviconId ? resolved.url : null;
  const showIcon = Boolean(logo || icon) && !failed;

  return (
    <span
      title={info.label}
      className={cn(
        "flex shrink-0 select-none items-center justify-center overflow-hidden",
        dims.box,
        showIcon
          ? logo
            ? "bg-white shadow-hairline"
            : "bg-surface shadow-hairline"
          : "font-mono font-semibold tracking-[0.02em]",
        showIcon && dims.pad,
        className,
      )}
      style={
        showIcon
          ? undefined
          : {
              color: info.color,
              background: `color-mix(in oklch, ${info.color} 14%, var(--surface))`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${info.color} 22%, transparent)`,
            }
      }
    >
      {showIcon && (logo || icon) ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
        <img
          src={logo ? logo.src : (icon as string)}
          alt=""
          aria-hidden
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      ) : (
        <span className={dims.text}>{info.mark}</span>
      )}
    </span>
  );
}

export function SourceDot({ source, className }: { source: SourceId; className?: string }) {
  const info = sourceInfo(source);
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", className)}
      style={{ background: info.color }}
    />
  );
}
