"use client";

import { Loader2, Search as SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { SourceMark } from "@/components/SourceMark";
import { Button, EmptyState, Field, Well } from "@/components/ui/primitives";
import { useLibrary } from "@/lib/store";
import type { ChatBody, ChatMeta } from "@/lib/types";
import { escapeRegExp, relativeTime, snippetAround, stripMarkdown } from "@/lib/utils";

interface Hit {
  chat: ChatMeta;
  score: number;
  snippets: { messageId: string; role: string; text: string }[];
}

export function SearchView() {
  const params = useSearchParams();
  const { ready, chats, allBodies } = useLibrary();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(query);
  const [bodies, setBodies] = useState<ChatBody[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loading = ready && bodies === null;

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(timer);
  }, [query]);

  // Message bodies are only pulled in once, and only when search is used.
  useEffect(() => {
    if (!ready || bodies) return;
    let cancelled = false;
    allBodies()
      .then((loaded) => {
        if (!cancelled) setBodies(loaded);
      })
      .catch(() => {
        if (!cancelled) setBodies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, bodies, allBodies]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const q = debounced.trim();
    if (q.length < 2 || !bodies) return [];
    const needle = q.toLowerCase();
    const byId = new Map(bodies.map((b) => [b.id, b.messages]));
    const results: Hit[] = [];

    for (const chat of chats) {
      if (chat.archived) continue;
      let score = 0;
      const snippets: Hit["snippets"] = [];

      if (chat.title.toLowerCase().includes(needle)) score += 10;
      if (chat.tags.some((t) => t.toLowerCase().includes(needle))) score += 6;

      for (const message of byId.get(chat.id) ?? []) {
        const plain = stripMarkdown(message.content);
        const snippet = snippetAround(plain, q);
        if (!snippet) continue;
        score += message.role === "user" ? 4 : 2;
        if (snippets.length < 3) {
          snippets.push({ messageId: message.id, role: message.role, text: snippet });
        }
      }

      if (score > 0) results.push({ chat, score, snippets });
    }

    return results.sort((a, b) => b.score - a.score || b.chat.savedAt - a.chat.savedAt);
  }, [debounced, bodies, chats]);

  const showing = debounced.trim().length >= 2;

  return (
    <>
      <PageHeader
        title="Search"
        subtitle="Looks inside every answer you have saved - works offline."
      />

      <div className="mx-auto max-w-3xl px-4 pb-10 lg:px-8">
        <div className="sticky top-[68px] z-20 -mx-4 bg-page/90 px-4 pb-3 backdrop-blur-xl lg:top-[92px] lg:-mx-8 lg:px-8">
          <div className="relative">
            <SearchIcon
              size={15}
              strokeWidth={2.2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <Field
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search every saved answer…"
              className="h-11 pl-10 pr-10 text-[14px]"
              aria-label="Search"
              enterKeyHint="search"
            />
            {loading ? (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-3"
              />
            ) : query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-chip text-ink-3 hover:bg-hover hover:text-ink"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        </div>

        {!showing ? (
          <Well className="p-4">
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Type at least two characters. Search covers titles, tags, your questions and the full
              text of every answer stored on this device - no connection required.
            </p>
          </Well>
        ) : hits.length ? (
          <div className="space-y-2">
            <p className="px-1 pb-1 text-[11.5px] text-ink-3">
              {hits.length === 1 ? "1 chat matches" : `${hits.length} chats match`} “
              {debounced.trim()}”
            </p>
            {hits.map((hit) => (
              <Link
                key={hit.chat.id}
                href={`/chat?id=${hit.chat.id}${
                  hit.snippets[0] ? `#msg-${hit.snippets[0].messageId}` : ""
                }`}
                className="block rounded-card bg-surface p-3 shadow-card transition-colors hover:bg-hover"
              >
                <div className="flex items-center gap-2.5">
                  <SourceMark
                    source={hit.chat.source}
                    sourceUrl={hit.chat.sourceUrl}
                    faviconId={hit.chat.faviconAssetId}
                    size="sm"
                  />
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
                    <Highlight text={hit.chat.title} query={debounced} />
                  </p>
                  <span className="shrink-0 text-[10.5px] text-ink-3">
                    {relativeTime(hit.chat.savedAt)}
                  </span>
                </div>
                {hit.snippets.length ? (
                  <div className="mt-2 space-y-1.5 border-l-2 border-line pl-2.5">
                    {hit.snippets.map((snippet) => (
                      <p
                        key={snippet.messageId}
                        className="line-clamp-2 text-[12px] leading-relaxed text-ink-2"
                      >
                        <span className="mr-1.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-ink-3">
                          {snippet.role === "user" ? "Q" : "A"}
                        </span>
                        <Highlight text={snippet.text} query={debounced} />
                      </p>
                    ))}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchIcon size={18} strokeWidth={2} />}
            title="No matches"
            description={`Nothing saved on this device mentions “${debounced.trim()}”.`}
            action={
              <Link href="/import">
                <Button variant="primary">Add a chat about it</Button>
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: split output is positional
          <mark key={index} className="losto-hit">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
