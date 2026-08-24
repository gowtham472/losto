"use client";

import { useEffect, useState } from "react";
import { assetObjectUrl } from "@/lib/assets";
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
 * The site's own icon is downloaded at import time and kept with the chat, so
 * ChatGPT, Claude and every blog show their real mark and it still works with
 * no connection. Using each publisher's own icon avoids shipping hand-traced
 * trademarks, and it stays right when a company changes its logo. Until the
 * icon lands — or if the site never served one — a tinted monogram stands in.
 */
export function SourceMark({
  source,
  faviconId,
  size = "md",
  className,
}: {
  source: SourceId;
  /** Stored favicon asset id from the chat record. */
  faviconId?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const info = sourceInfo(source);
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
  const showIcon = Boolean(icon) && !failed;

  return (
    <span
      title={info.label}
      className={cn(
        "flex shrink-0 select-none items-center justify-center overflow-hidden",
        dims.box,
        showIcon ? "bg-surface shadow-hairline" : "font-mono font-semibold tracking-[0.02em]",
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
      {showIcon && icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
        <img
          src={icon}
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
