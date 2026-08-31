"use client";

import {
  ArrowDownWideNarrow,
  Inbox,
  LayoutGrid,
  Rows3,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { ChatActions } from "@/components/ChatActions";
import { ChatCard, ChatCardSkeleton } from "@/components/ChatCard";
import { SourceMark } from "@/components/SourceMark";
import { Button, Chip, EmptyState, Field, Segmented } from "@/components/ui/primitives";
import { COLLECTION_COLORS, SOURCE_ORDER, sourceInfo } from "@/lib/sources";
import { useLibrary } from "@/lib/store";
import type { ChatMeta, SortKey } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "opened", label: "Recently opened" },
  { value: "title", label: "Title A–Z" },
  { value: "longest", label: "Longest first" },
  { value: "oldest", label: "Oldest first" },
];

export function LibraryView() {
  const { ready, error, chats, collections, settings, setSetting, updateChat } = useLibrary();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [menuChat, setMenuChat] = useState<ChatMeta | null>(null);
  const [query, setQuery] = useState("");

  const activeCollection = params.get("collection");
  const activeSource = params.get("source");
  const favouritesOnly = params.get("fav") === "1";

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const visible = useMemo(() => chats.filter((c) => !c.archived), [chats]);

  const usedSources = useMemo(() => {
    const set = new Set(visible.map((c) => c.source));
    return SOURCE_ORDER.filter((s) => set.has(s));
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = visible.filter((chat) => {
      if (activeCollection && chat.collectionId !== activeCollection) return false;
      if (activeSource && chat.source !== activeSource) return false;
      if (favouritesOnly && !chat.favorite) return false;
      if (!q) return true;
      return (
        chat.title.toLowerCase().includes(q) ||
        chat.excerpt.toLowerCase().includes(q) ||
        chat.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    const sorted = [...list];
    switch (settings.sort) {
      case "opened":
        sorted.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "longest":
        sorted.sort((a, b) => b.wordCount - a.wordCount);
        break;
      case "oldest":
        sorted.sort((a, b) => a.savedAt - b.savedAt);
        break;
      default:
        sorted.sort((a, b) => b.savedAt - a.savedAt);
    }
    return sorted;
  }, [visible, query, activeCollection, activeSource, favouritesOnly, settings.sort]);

  const continueReading = useMemo(
    () =>
      visible
        .filter((c) => c.progress > 0.02 && c.progress < 0.98)
        .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        .slice(0, 4),
    [visible],
  );

  const collectionsById = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  const hasFilters = Boolean(activeCollection || activeSource || favouritesOnly || query);
  const totalMinutes = visible.reduce((sum, c) => sum + c.readMinutes, 0);

  return (
    <>
      <PageHeader
        title="Library"
        subtitle={
          ready
            ? visible.length
              ? `${visible.length} ${visible.length === 1 ? "chat" : "chats"} saved · ${totalMinutes} min of reading, all offline`
              : "Nothing saved yet"
            : "Loading your library…"
        }
        actions={
          <>
            <SortMenu value={settings.sort} onChange={(v) => setSetting("sort", v)} />
            <Segmented
              size="sm"
              value={settings.view}
              onChange={(v) => setSetting("view", v)}
              options={[
                { value: "grid", label: <LayoutGrid size={13} strokeWidth={2.2} />, title: "Grid" },
                { value: "list", label: <Rows3 size={13} strokeWidth={2.2} />, title: "List" },
              ]}
              className="hidden sm:inline-flex"
            />
          </>
        }
      />

      <div className="mx-auto max-w-5xl px-4 lg:px-8">
        {error ? (
          <div className="mb-4 rounded-card bg-red-tint p-3 text-[12.5px] text-red shadow-hairline">
            {error}
          </div>
        ) : null}

        {/* filters */}
        <div className="sticky top-[68px] z-20 -mx-4 mb-5 bg-page/90 px-4 pb-3 pt-2 backdrop-blur-xl lg:top-[92px] lg:-mx-8 lg:px-8">
          <div className="relative mb-2">
            <Search
              size={14}
              strokeWidth={2.2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <Field
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this list…"
              className="h-9 pl-9 pr-9"
              aria-label="Filter library"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-chip text-ink-3 hover:bg-hover hover:text-ink"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>

          <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 py-1 lg:-mx-8 lg:px-8">
            <Chip active={!hasFilters} onClick={() => router.replace(pathname, { scroll: false })}>
              All
            </Chip>
            <Chip
              active={favouritesOnly}
              onClick={() => setParam("fav", favouritesOnly ? null : "1")}
            >
              <Star size={11} strokeWidth={2.4} fill={favouritesOnly ? "currentColor" : "none"} />
              Favourites
            </Chip>

            {collections.length ? <Divider /> : null}
            {collections.map((collection) => (
              <Chip
                key={collection.id}
                active={activeCollection === collection.id}
                onClick={() =>
                  setParam("collection", activeCollection === collection.id ? null : collection.id)
                }
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background:
                      activeCollection === collection.id
                        ? "currentColor"
                        : (COLLECTION_COLORS[collection.color] ?? "var(--ink-3)"),
                  }}
                />
                {collection.name}
              </Chip>
            ))}

            {usedSources.length > 1 ? <Divider /> : null}
            {usedSources.length > 1
              ? usedSources.map((source) => (
                  <Chip
                    key={source}
                    active={activeSource === source}
                    onClick={() => setParam("source", activeSource === source ? null : source)}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        background:
                          activeSource === source ? "currentColor" : sourceInfo(source).color,
                      }}
                    />
                    {sourceInfo(source).label}
                  </Chip>
                ))
              : null}
          </div>
        </div>

        {/* continue reading */}
        {!hasFilters && continueReading.length ? (
          <section className="mb-6">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              <Sparkles size={11} strokeWidth={2.4} />
              Pick up where you left off
            </p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:-mx-8 lg:px-8">
              {continueReading.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat?id=${chat.id}`}
                  className="group flex w-[240px] shrink-0 flex-col gap-3 rounded-card bg-surface p-4 shadow-card transition-colors hover:bg-hover"
                >
                  <div className="flex items-center gap-2">
                    <SourceMark
                      source={chat.source}
                      sourceUrl={chat.sourceUrl}
                      faviconId={chat.faviconAssetId}
                      size="sm"
                    />
                    <span className="font-mono text-[10px] tabnums text-ink-3">
                      {Math.round(chat.progress * 100)}%
                    </span>
                    <span className="ml-auto text-[10px] text-ink-3">
                      {relativeTime(chat.lastOpenedAt)}
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-[2.4em] text-[12.5px] font-semibold leading-[1.35] tracking-[-0.015em] text-ink">
                    {chat.title}
                  </p>
                  <span className="mt-auto block h-[3px] overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.round(chat.progress * 100)}%` }}
                    />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* results */}
        {!ready ? (
          <div className={gridClass(settings.view)}>
            {Array.from({ length: 6 }).map((_, i) => (
              <ChatCardSkeleton key={i} view={settings.view} />
            ))}
          </div>
        ) : filtered.length ? (
          <div className={cn(gridClass(settings.view), "pb-8")}>
            {filtered.map((chat) => (
              <ChatCard
                key={chat.id}
                chat={chat}
                collection={
                  chat.collectionId ? collectionsById.get(chat.collectionId) : undefined
                }
                view={settings.view}
                onMenu={setMenuChat}
                onToggleFavorite={(c) => updateChat(c.id, { favorite: !c.favorite })}
              />
            ))}
          </div>
        ) : visible.length ? (
          <EmptyState
            icon={<Search size={18} strokeWidth={2} />}
            title="Nothing matches those filters"
            description="Try clearing the filters or searching the full text of your chats instead."
            action={
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setQuery("");
                    router.replace(pathname, { scroll: false });
                  }}
                >
                  Clear filters
                </Button>
                <Link href={`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}>
                  <Button variant="primary">Full-text search</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <EmptyState
            icon={<Inbox size={18} strokeWidth={2} />}
            title="Your library is empty"
            description="Paste a ChatGPT, Claude or Perplexity share link and Losto pulls the whole conversation onto this device - ready to read when the campus wifi gives up."
            action={
              <Link href="/import">
                <Button variant="primary" size="lg">
                  Add your first chat
                </Button>
              </Link>
            }
          />
        )}
      </div>

      <ChatActions chat={menuChat} onClose={() => setMenuChat(null)} />
    </>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-line-strong" />;
}

function gridClass(view: "grid" | "list") {
  return view === "list"
    ? "flex flex-col gap-1.5"
    : "grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3";
}

function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const current = SORTS.find((s) => s.value === value) ?? SORTS[0];

  return (
    <div className="relative">
      <Button size="md" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ArrowDownWideNarrow size={13} strokeWidth={2.2} />
        <span className="hidden sm:inline">{current.label}</span>
      </Button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close sort menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade-up absolute right-0 top-9 z-40 w-48 overflow-hidden rounded-card bg-surface p-1 shadow-overlay">
            {SORTS.map((sort) => (
              <button
                key={sort.value}
                type="button"
                onClick={() => {
                  onChange(sort.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 w-full items-center rounded-[6px] px-2 text-left text-[12.5px] font-medium transition-colors",
                  sort.value === value ? "bg-accent-tint text-accent-ink" : "text-ink-2 hover:bg-hover hover:text-ink",
                )}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
