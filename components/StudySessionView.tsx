"use client";

import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, Shuffle, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { Button, Card, EmptyState, Skeleton, Well } from "@/components/ui/primitives";
import { toQuestionPairs } from "@/lib/markdown";
import { useLibrary } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export function StudySessionView() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          title="No chat selected"
          description="Pick a chat from the study list to start revising."
          action={
            <Link href="/study">
              <Button variant="primary">Choose a chat</Button>
            </Link>
          }
        />
      </div>
    );
  }
  return <StudySession id={id} />;
}

/* -------------------------------------------------------------------------- */
/* Session                                                                    */
/* -------------------------------------------------------------------------- */

function StudySession({ id }: { id: string }) {
  const router = useRouter();
  const { ready, chats, settings, loadBody } = useLibrary();
  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [again, setAgain] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadBody(id).then((body) => {
      if (cancelled) return;
      setMessages(body);
      setOrder(toQuestionPairs(body).map((_, index) => index));
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadBody]);

  const pairs = useMemo(() => (messages ? toQuestionPairs(messages) : []), [messages]);
  const current = pairs[order[cursor]];
  const finished = order.length > 0 && cursor >= order.length;

  // Moving to another card always hides its answer again.
  const goTo = useCallback((next: number | ((c: number) => number)) => {
    setCursor((c) => {
      const target = typeof next === "function" ? next(c) : next;
      return Math.max(0, target);
    });
    setRevealed(false);
  }, []);

  // Space reveals, arrows move - this is a keyboard-friendly revision loop.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(event.target.tagName)) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setRevealed((v) => !v);
      }
      if (event.key === "ArrowRight") goTo((c) => Math.min(order.length, c + 1));
      if (event.key === "ArrowLeft") goTo((c) => c - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order.length, goTo]);

  const restart = (shuffle: boolean, onlyAgain = false) => {
    const base = onlyAgain
      ? pairs.map((p, index) => ({ p, index })).filter(({ p }) => again.has(p.id)).map((x) => x.index)
      : pairs.map((_, index) => index);
    setOrder(shuffle ? [...base].sort(() => Math.random() - 0.5) : base);
    goTo(0);
    setKnown(new Set());
    setAgain(new Set());
  };

  if (ready && !chat) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          title="That chat is not on this device"
          action={
            <Link href="/study">
              <Button variant="primary">Back to study</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="sticky top-0 z-30 bg-page/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-2 px-2 lg:px-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Leave study mode"
            onClick={() => router.push(`/chat?id=${id}`)}
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold tracking-[-0.015em] text-ink">
              {chat?.title ?? "Study"}
            </p>
          </div>
          <span className="font-mono text-[11px] tabnums text-ink-3">
            {Math.min(cursor + 1, order.length || 1)} / {order.length || 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Shuffle cards"
            onClick={() => restart(true)}
            disabled={!pairs.length}
          >
            <Shuffle size={15} strokeWidth={2.2} />
          </Button>
        </div>
        <div className="h-px bg-line">
          <div
            className="h-px bg-accent transition-[width] duration-300"
            style={{ width: `${order.length ? (cursor / order.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-6">
        {!messages ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
        ) : !pairs.length ? (
          <EmptyState
            title="No question cards here"
            description="This chat has no questions to quiz on - it was saved as a single article."
            action={
              <Link href={`/chat?id=${id}`}>
                <Button variant="primary">Read it instead</Button>
              </Link>
            }
          />
        ) : finished ? (
          <Summary
            total={order.length}
            known={known.size}
            again={again.size}
            onRestart={() => restart(false)}
            onShuffle={() => restart(true)}
            onReviewAgain={() => restart(true, true)}
            chatId={id}
          />
        ) : current ? (
          <div className="flex flex-1 flex-col">
            <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
              Question {cursor + 1}
            </p>
            <Card className="p-4">
              <div
                className="prose-losto"
                style={{ ["--reader-size" as string]: `${settings.readerSize + 1}px` }}
              >
                <Markdown content={current.question || "(no question text)"} />
              </div>
            </Card>

            {revealed ? (
              <div className="animate-fade-up mt-3">
                <p className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                  Answer
                </p>
                <Card className="p-4">
                  <div style={{ ["--reader-size" as string]: `${settings.readerSize}px` }}>
                    <Markdown content={current.answer} typeface={settings.readerTypeface} />
                  </div>
                </Card>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="stripes mt-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-well py-14 text-ink-2 transition-colors hover:text-ink"
              >
                <Eye size={18} strokeWidth={2} />
                <span className="text-[12.5px] font-medium">Tap to reveal the answer</span>
                <span className="hidden text-[11px] text-ink-3 sm:block">or press space</span>
              </button>
            )}
          </div>
        ) : null}
      </main>

      {pairs.length && !finished ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)]">
            <Button
              size="lg"
              aria-label="Previous card"
              onClick={() => goTo((c) => c - 1)}
              disabled={cursor === 0}
            >
              <ArrowLeft size={15} strokeWidth={2.2} />
            </Button>

            {revealed ? (
              <>
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    if (current) setAgain((s) => new Set(s).add(current.id));
                    goTo((c) => c + 1);
                  }}
                >
                  <RotateCcw size={14} strokeWidth={2.2} />
                  Review again
                </Button>
                <Button
                  size="lg"
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    if (current) setKnown((s) => new Set(s).add(current.id));
                    goTo((c) => c + 1);
                  }}
                >
                  <Check size={15} strokeWidth={2.6} />
                  Got it
                </Button>
              </>
            ) : (
              <Button size="lg" variant="primary" className="flex-1" onClick={() => setRevealed(true)}>
                <Eye size={14} strokeWidth={2.2} />
                Show answer
              </Button>
            )}

            <Button
              size="lg"
              aria-label="Next card"
              onClick={() => goTo((c) => c + 1)}
            >
              <ArrowRight size={15} strokeWidth={2.2} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  total,
  known,
  again,
  onRestart,
  onShuffle,
  onReviewAgain,
  chatId,
}: {
  total: number;
  known: number;
  again: number;
  onRestart: () => void;
  onShuffle: () => void;
  onReviewAgain: () => void;
  chatId: string;
}) {
  const percent = total ? Math.round((known / total) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-green-tint text-green">
        <Check size={26} strokeWidth={2.4} />
      </div>
      <div>
        <p className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink">
          {percent}% confident
        </p>
        <p className="mt-1 text-[12.5px] text-ink-2">
          {known} of {total} cards marked as known
        </p>
      </div>

      <Well className="grid w-full max-w-xs grid-cols-2 divide-x divide-line">
        <div className="p-3">
          <p className="font-mono text-[18px] font-semibold tabnums text-green">{known}</p>
          <p className="text-[11px] text-ink-3">Got it</p>
        </div>
        <div className="p-3">
          <p className="font-mono text-[18px] font-semibold tabnums text-orange">{again}</p>
          <p className="text-[11px] text-ink-3">To review</p>
        </div>
      </Well>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {again ? (
          <Button variant="primary" onClick={onReviewAgain}>
            <RotateCcw size={14} strokeWidth={2.2} />
            Review the {again} again
          </Button>
        ) : null}
        <Button onClick={onShuffle}>
          <Shuffle size={14} strokeWidth={2.2} />
          Shuffle and restart
        </Button>
        <Button variant="subtle" onClick={onRestart}>
          Start over
        </Button>
        <Link href={`/chat?id=${chatId}`}>
          <Button variant="ghost">
            <X size={14} strokeWidth={2.2} />
            Back to the chat
          </Button>
        </Link>
      </div>
    </div>
  );
}
