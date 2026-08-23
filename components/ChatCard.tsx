"use client";

import { MessagesSquare, MoreHorizontal, Star, Timer } from "lucide-react";
import Link from "next/link";
import { COLLECTION_COLORS } from "@/lib/sources";
import type { ChatMeta, Collection } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import { SourceMark } from "./SourceMark";
import { Tag } from "./ui/primitives";

export function ChatCard({
  chat,
  collection,
  view,
  onMenu,
  onToggleFavorite,
}: {
  chat: ChatMeta;
  collection?: Collection;
  view: "grid" | "list";
  onMenu: (chat: ChatMeta) => void;
  onToggleFavorite: (chat: ChatMeta) => void;
}) {
  const progress = Math.round(chat.progress * 100);
  // Titles derived from the opening question repeat the excerpt verbatim.
  const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
  const showExcerpt = Boolean(chat.excerpt) && key(chat.excerpt) !== key(chat.title);

  return (
    <div
      className={cn(
        "group relative rounded-card bg-surface shadow-card transition-[background-color,box-shadow] duration-150",
        "hover:bg-hover hover:shadow-raised",
        view === "list" ? "flex items-center gap-3 p-2.5" : "flex flex-col p-3",
      )}
    >
      <Link
        href={`/chat?id=${chat.id}`}
        className="absolute inset-0 z-0 rounded-card"
        aria-label={`Open ${chat.title}`}
      />

      {view === "list" ? (
        <>
          <SourceMark source={chat.source} size="md" className="relative z-10" />
          <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
            <p className="truncate text-[13px] font-semibold leading-tight tracking-[-0.015em] text-ink">
              {chat.title}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-2">
              {collection ? `${collection.name} · ` : ""}
              {chat.messageCount} turns · {chat.readMinutes} min ·{" "}
              {relativeTime(chat.savedAt)}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="pointer-events-none relative z-10 flex items-start gap-2.5">
            <SourceMark source={chat.source} size="md" />
            <p className="mt-0.5 line-clamp-2 flex-1 text-[13.5px] font-semibold leading-[1.35] tracking-[-0.015em] text-ink">
              {chat.title}
            </p>
          </div>

          {showExcerpt ? (
            <p className="pointer-events-none relative z-10 mt-2 line-clamp-2 text-[12px] leading-relaxed text-ink-2">
              {chat.excerpt}
            </p>
          ) : null}

          <div className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-center gap-1.5 pt-3">
            {collection ? (
              <Tag>
                <span
                  className="mr-1 size-1.5 rounded-full"
                  style={{ background: COLLECTION_COLORS[collection.color] ?? "var(--ink-3)" }}
                />
                {collection.name}
              </Tag>
            ) : null}
            {chat.tags.slice(0, 2).map((tag) => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
            <span className="ml-auto flex items-center gap-2 font-mono text-[10px] tabnums text-ink-3">
              <span className="flex items-center gap-1">
                <MessagesSquare size={10} strokeWidth={2.2} />
                {chat.messageCount}
              </span>
              <span className="flex items-center gap-1">
                <Timer size={10} strokeWidth={2.2} />
                {chat.readMinutes}m
              </span>
            </span>
          </div>
        </>
      )}

      <div className="relative z-10 ml-auto flex shrink-0 items-center gap-0.5 self-start">
        <button
          type="button"
          aria-label={chat.favorite ? "Remove from favourites" : "Add to favourites"}
          aria-pressed={chat.favorite}
          onClick={(event) => {
            event.preventDefault();
            onToggleFavorite(chat);
          }}
          className={cn(
            "flex size-7 items-center justify-center rounded-chip transition-colors",
            chat.favorite
              ? "text-orange"
              : "text-ink-3 opacity-0 hover:bg-hover-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          <Star size={13} strokeWidth={2.2} fill={chat.favorite ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          aria-label="Chat options"
          onClick={(event) => {
            event.preventDefault();
            onMenu(chat);
          }}
          className="flex size-7 items-center justify-center rounded-chip text-ink-3 transition-colors hover:bg-hover-2 hover:text-ink"
        >
          <MoreHorizontal size={14} strokeWidth={2.2} />
        </button>
      </div>

      {progress > 2 && progress < 99 ? (
        <span className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </span>
      ) : null}
    </div>
  );
}

export function ChatCardSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className="flex items-center gap-3 rounded-card bg-surface p-2.5 shadow-card">
        <div className="shimmer size-8 rounded-[8px]" />
        <div className="flex-1 space-y-1.5">
          <div className="shimmer h-3 w-2/3 rounded-full" />
          <div className="shimmer h-2.5 w-1/3 rounded-full" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-card bg-surface p-3 shadow-card">
      <div className="flex gap-2.5">
        <div className="shimmer size-8 rounded-[8px]" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <div className="shimmer h-3 w-full rounded-full" />
          <div className="shimmer h-3 w-1/2 rounded-full" />
        </div>
      </div>
      <div className="shimmer h-2.5 w-full rounded-full" />
      <div className="shimmer h-2.5 w-4/5 rounded-full" />
    </div>
  );
}
