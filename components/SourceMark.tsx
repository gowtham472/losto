"use client";

import { sourceInfo } from "@/lib/sources";
import type { SourceId } from "@/lib/types";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-6 text-[8.5px] rounded-[6px]",
  md: "size-8 text-[10px] rounded-[8px]",
  lg: "size-10 text-[11.5px] rounded-[10px]",
} as const;

/** The tinted monogram tile that identifies which assistant a chat came from. */
export function SourceMark({
  source,
  size = "md",
  className,
}: {
  source: SourceId;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const info = sourceInfo(source);
  return (
    <span
      title={info.label}
      className={cn(
        "flex shrink-0 select-none items-center justify-center font-mono font-semibold tracking-[0.02em]",
        SIZES[size],
        className,
      )}
      style={{
        color: info.color,
        background: `color-mix(in oklch, ${info.color} 14%, var(--surface))`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${info.color} 22%, transparent)`,
      }}
    >
      {info.mark}
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
