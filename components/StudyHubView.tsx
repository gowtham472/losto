"use client";

import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { SourceMark } from "@/components/SourceMark";
import { Button, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useLibrary } from "@/lib/store";
import { relativeTime } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Hub                                                                        */
/* -------------------------------------------------------------------------- */

export function StudyHubView() {
  const { ready, chats, collections } = useLibrary();
  const active = useMemo(
    () => chats.filter((c) => !c.archived).sort((a, b) => b.savedAt - a.savedAt),
    [chats],
  );

  const byCollection = useMemo(() => {
    const map = new Map<string, number>();
    for (const chat of active) {
      if (!chat.collectionId) continue;
      map.set(chat.collectionId, (map.get(chat.collectionId) ?? 0) + 1);
    }
    return map;
  }, [active]);

  return (
    <>
      <PageHeader
        title="Study"
        subtitle="Turn any saved chat into question cards - reveal the answer only when you are ready."
      />

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 lg:px-8">
        {!ready ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-card" />
            ))}
          </div>
        ) : active.length ? (
          <>
            {collections.length ? (
              <section>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  By subject
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {collections
                    .filter((c) => byCollection.get(c.id))
                    .map((collection) => (
                      <Link
                        key={collection.id}
                        href={`/?collection=${collection.id}`}
                        className="flex flex-col gap-1 rounded-card bg-surface p-3 shadow-card transition-colors hover:bg-hover"
                      >
                        <span className="text-[13px] font-semibold tracking-[-0.015em] text-ink">
                          {collection.emoji ? `${collection.emoji} ` : ""}
                          {collection.name}
                        </span>
                        <span className="font-mono text-[10.5px] tabnums text-ink-3">
                          {byCollection.get(collection.id)} chats
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
            ) : null}

            <section>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Pick a chat to revise
              </p>
              <div className="flex flex-col gap-1.5">
                {active.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/study/session?id=${chat.id}`}
                    className="flex items-center gap-3 rounded-card bg-surface p-2.5 shadow-card transition-colors hover:bg-hover"
                  >
                    <SourceMark source={chat.source} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
                        {chat.title}
                      </p>
                      <p className="truncate text-[11.5px] text-ink-2">
                        {Math.max(1, Math.floor(chat.messageCount / 2))} question cards ·{" "}
                        {relativeTime(chat.savedAt)}
                      </p>
                    </div>
                    <GraduationCap size={15} strokeWidth={2.1} className="shrink-0 text-ink-3" />
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : (
          <EmptyState
            icon={<GraduationCap size={18} strokeWidth={2} />}
            title="Nothing to study yet"
            description="Save a chat first - every question you asked becomes a card you can quiz yourself with."
            action={
              <Link href="/import">
                <Button variant="primary">Add a chat</Button>
              </Link>
            }
          />
        )}
      </div>
    </>
  );
}
