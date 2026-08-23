"use client";

import {
  ArrowLeft,
  Baseline,
  Brain,
  Check,
  Copy,
  ExternalLink,
  GraduationCap,
  List,
  MoreHorizontal,
  Pin,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatActions } from "@/components/ChatActions";
import { Markdown } from "@/components/Markdown";
import { SourceMark } from "@/components/SourceMark";
import { Button, EmptyState, Segmented, Skeleton, Well } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useLibrary } from "@/lib/store";
import type { ChatMessage, ChatMeta } from "@/lib/types";
import { cn, copyText, formatDate, stripMarkdown, truncate } from "@/lib/utils";

export function ReaderView() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const { ready, chats, settings, setSetting, updateChat, loadBody } = useLibrary();
  const toast = useToast();

  const chat = useMemo(() => chats.find((c) => c.id === id), [chats, id]);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadBody(id).then((body) => {
      if (!cancelled) setMessages(body);
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadBody]);

  /*
   * Saving progress rewrites the chat record, which hands back a new `chat`
   * object. Effects therefore key off the id and reach the writer through refs
   * - depending on `chat` itself would make every save retrigger the effect.
   */
  const chatId = chat?.id;
  const updateRef = useRef(updateChat);
  const chatIdRef = useRef<string | undefined>(undefined);
  const restoreRef = useRef<number | null>(null);
  const saved = useRef(0);

  useEffect(() => {
    updateRef.current = updateChat;
  }, [updateChat]);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Latch the stored position before any scrolling starts overwriting it.
  const storedProgress = chat?.progress;
  useEffect(() => {
    if (restoreRef.current === null && storedProgress !== undefined) {
      restoreRef.current = storedProgress;
    }
  }, [storedProgress]);

  // Stamp the open once per mount, and restore the reading position.
  useEffect(() => {
    if (!chatId || openedRef.current || !messages) return;
    openedRef.current = true;
    updateRef.current(chatId, { lastOpenedAt: Date.now() });

    // A #msg-… hash comes from a search result and wins over saved progress.
    const target = window.location.hash.slice(1);
    if (target) {
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ block: "start" });
      });
      return;
    }

    const resume = restoreRef.current ?? 0;
    if (resume > 0.02 && resume < 0.98) {
      requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 200) window.scrollTo({ top: max * resume });
      });
    }
  }, [chatId, messages]);

  // Persist the reading position, but only once it moves meaningfully.
  useEffect(() => {
    const onScroll = (event?: Event) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 40 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1;
      setProgress(value);

      // The priming call just paints the bar; short pages are never "finished".
      if (!event || max <= 200) return;
      const currentId = chatIdRef.current;
      if (currentId && Math.abs(value - saved.current) > 0.05) {
        saved.current = value;
        updateRef.current(currentId, { progress: value });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Write the final position when the reader leaves the page.
  useEffect(() => {
    return () => {
      const currentId = chatIdRef.current;
      if (currentId && saved.current > 0) {
        updateRef.current(currentId, { progress: saved.current });
      }
    };
  }, []);

  const questions = useMemo(
    () => (messages ?? []).filter((m) => m.role === "user"),
    [messages],
  );
  const ordinals = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach((question, index) => map.set(question.id, index + 1));
    return map;
  }, [questions]);

  if (ready && !chat) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <EmptyState
          title="That chat is not on this device"
          description="It may have been deleted, or saved on another device. Restore a backup from Settings if you have one."
          action={
            <Link href="/">
              <Button variant="primary">Back to library</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-page">
      <header className="sticky top-0 z-40 bg-page/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-2 lg:px-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          >
            <ArrowLeft size={16} strokeWidth={2.2} />
          </Button>

          {chat ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SourceMark source={chat.source} size="sm" />
              <p className="truncate text-[12.5px] font-semibold tracking-[-0.015em] text-ink">
                {chat.title}
              </p>
            </div>
          ) : (
            <Skeleton className="h-3 flex-1" />
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label="Outline"
            onClick={() => setOutlineOpen(true)}
            disabled={!questions.length}
          >
            <List size={16} strokeWidth={2.2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reading settings"
            onClick={() => setTypeOpen(true)}
          >
            <Baseline size={16} strokeWidth={2.2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="More"
            onClick={() => setMenuOpen(true)}
            disabled={!chat}
          >
            <MoreHorizontal size={16} strokeWidth={2.2} />
          </Button>
        </div>
        <div className="h-px bg-line">
          <div
            className="h-px bg-accent transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 pb-32 pt-6 lg:px-4">
        {chat ? <ReaderTitle chat={chat} onFavorite={() => updateChat(chat.id, { favorite: !chat.favorite })} /> : null}

        {!messages ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : messages.length ? (
          <div
            className={cn("mt-7", settings.readerLayout === "chat" ? "space-y-7" : "space-y-5")}
            style={{ ["--reader-size" as string]: `${settings.readerSize}px` }}
          >
            {messages.map((message) => (
              <MessageBlock
                key={message.id}
                message={message}
                ordinal={ordinals.get(message.id)}
                chat={chat}
                layout={settings.readerLayout}
                typeface={settings.readerTypeface}
                showThinking={settings.showThinking}
                onPin={() => {
                  if (!chat) return;
                  const pinned = chat.pinned.includes(message.id)
                    ? chat.pinned.filter((p) => p !== message.id)
                    : [...chat.pinned, message.id];
                  updateChat(chat.id, { pinned });
                }}
                onCopy={async () => {
                  if (await copyText(message.content)) toast.success("Copied");
                }}
              />
            ))}

            <div className="flex flex-col items-center gap-3 pt-10">
              <p className="text-[11.5px] text-ink-3">
                End of chat · saved {formatDate(chat?.savedAt)}
              </p>
              <div className="flex gap-2">
                <Link href={`/study/session?id=${chat?.id}`}>
                  <Button variant="primary">
                    <GraduationCap size={14} strokeWidth={2.2} />
                    Study these questions
                  </Button>
                </Link>
                {chat?.sourceUrl ? (
                  <a href={chat.sourceUrl} target="_blank" rel="noreferrer noopener">
                    <Button variant="subtle">
                      <ExternalLink size={13} strokeWidth={2.2} />
                      Original
                    </Button>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="This chat has no content" description="The saved copy is empty." />
        )}
      </article>

      {/* outline */}
      <Sheet
        open={outlineOpen}
        onClose={() => setOutlineOpen(false)}
        title="Questions in this chat"
        description={`${questions.length} ${questions.length === 1 ? "question" : "questions"}`}
      >
        <ol className="space-y-1">
          {questions.map((question, index) => (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => {
                  setOutlineOpen(false);
                  document
                    .getElementById(`msg-${question.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex w-full gap-2.5 rounded-control p-2 text-left transition-colors hover:bg-hover"
              >
                <span className="mt-px font-mono text-[10.5px] tabnums text-ink-3">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[12.5px] leading-snug text-ink">
                  {truncate(stripMarkdown(question.content), 110)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Sheet>

      {/* typography */}
      <Sheet
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title="Reading settings"
        description="Applies to every chat you read."
      >
        <div className="space-y-4">
          <Row label="Text size">
            <div className="flex items-center gap-1.5">
              <Button
                size="icon-sm"
                aria-label="Smaller text"
                onClick={() => setSetting("readerSize", Math.max(13, settings.readerSize - 1))}
              >
                <span className="text-[11px] font-semibold">A</span>
              </Button>
              <span className="w-9 text-center font-mono text-[11.5px] tabnums text-ink-2">
                {settings.readerSize}px
              </span>
              <Button
                size="icon-sm"
                aria-label="Larger text"
                onClick={() => setSetting("readerSize", Math.min(22, settings.readerSize + 1))}
              >
                <span className="text-[14px] font-semibold">A</span>
              </Button>
            </div>
          </Row>

          <Row label="Typeface">
            <Segmented
              value={settings.readerTypeface}
              onChange={(v) => setSetting("readerTypeface", v)}
              options={[
                { value: "sans", label: "Sans" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Mono" },
              ]}
            />
          </Row>

          <Row label="Layout">
            <Segmented
              value={settings.readerLayout}
              onChange={(v) => setSetting("readerLayout", v)}
              options={[
                { value: "chat", label: "Chat" },
                { value: "document", label: "Document" },
              ]}
            />
          </Row>

          <Row label="Show reasoning">
            <Segmented
              value={settings.showThinking ? "on" : "off"}
              onChange={(v) => setSetting("showThinking", v === "on")}
              options={[
                { value: "off", label: "Hide" },
                { value: "on", label: "Show" },
              ]}
            />
          </Row>

          <Well className="p-3">
            <p
              className="prose-losto"
              data-typeface={settings.readerTypeface}
              style={{ ["--reader-size" as string]: `${settings.readerSize}px` }}
            >
              The quick brown fox jumps over the lazy dog - and every equation, table and code block
              stays exactly as the assistant wrote it.
            </p>
          </Well>
        </div>
      </Sheet>

      {menuOpen && chat ? (
        <ChatActions
          chat={chat}
          onClose={() => setMenuOpen(false)}
          onDeleted={() => router.push("/")}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReaderTitle({ chat, onFavorite }: { chat: ChatMeta; onFavorite: () => void }) {
  return (
    <div className="space-y-3">
      <h1 className="font-display text-[26px] font-bold leading-[1.15] tracking-[-0.035em] text-ink lg:text-[32px]">
        {chat.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-2">
        <span className="flex items-center gap-1.5">
          <SourceMark source={chat.source} size="sm" />
          {chat.model ?? undefined}
        </span>
        <Dot />
        <span>{chat.messageCount} turns</span>
        <Dot />
        <span>{chat.wordCount.toLocaleString()} words</span>
        <Dot />
        <span>{chat.readMinutes} min</span>
        <Dot />
        <span>saved {formatDate(chat.savedAt)}</span>
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={chat.favorite}
          className={cn(
            "ml-auto flex size-7 items-center justify-center rounded-chip transition-colors",
            chat.favorite ? "text-orange" : "text-ink-3 hover:bg-hover hover:text-ink",
          )}
          aria-label={chat.favorite ? "Remove from favourites" : "Add to favourites"}
        >
          <Star size={14} strokeWidth={2.2} fill={chat.favorite ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="text-ink-3">·</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12.5px] font-medium text-ink">{label}</span>
      {children}
    </div>
  );
}

function MessageBlock({
  message,
  ordinal,
  chat,
  layout,
  typeface,
  showThinking,
  onPin,
  onCopy,
}: {
  message: ChatMessage;
  /** Position among the questions, for the "Question 3" label. */
  ordinal?: number;
  chat?: ChatMeta;
  layout: "chat" | "document";
  typeface: "sans" | "serif" | "mono";
  showThinking: boolean;
  onPin: () => void;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pinned = chat?.pinned.includes(message.id) ?? false;

  const copy = async () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (message.role === "user") {
    return (
      <section id={`msg-${message.id}`} className="group scroll-mt-16">
        {layout === "chat" ? (
          <div className="rounded-card bg-inset p-3 shadow-hairline">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                Question {ordinal ?? 1}
              </span>
              <PinButton pinned={pinned} onClick={onPin} />
            </div>
            <Markdown content={message.content} typeface={typeface} className="text-ink" />
          </div>
        ) : (
          <div className="border-l-2 border-accent pl-3">
            <h2 className="font-display text-[19px] font-semibold leading-snug tracking-[-0.025em] text-ink">
              {stripMarkdown(message.content).slice(0, 300) || "Question"}
            </h2>
          </div>
        )}
      </section>
    );
  }

  return (
    <section id={`msg-${message.id}`} className="group scroll-mt-16">
      {message.thinking && showThinking ? (
        <details className="mb-3 overflow-hidden rounded-card bg-inset shadow-hairline">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11.5px] font-medium text-ink-2 hover:bg-hover">
            <Brain size={12} strokeWidth={2.2} />
            Reasoning
          </summary>
          <div className="border-t border-line px-3 py-2.5">
            <Markdown
              content={message.thinking}
              typeface={typeface}
              className="text-[13px] text-ink-2"
            />
          </div>
        </details>
      ) : null}

      <Markdown content={message.content} typeface={typeface} headingPrefix={message.id} />

      {message.citations?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.citations.slice(0, 8).map((citation) => (
            <a
              key={citation.url}
              href={citation.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-full bg-surface px-2 text-[11px] text-ink-2 shadow-btn transition-colors hover:bg-hover hover:text-ink"
            >
              <span className="truncate">{citation.title ?? new URL(citation.url).hostname}</span>
              <ExternalLink size={9} strokeWidth={2.4} className="shrink-0" />
            </a>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          onClick={copy}
          className="flex h-7 items-center gap-1.5 rounded-chip px-2 text-[11.5px] font-medium text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          {copied ? (
            <Check size={12} strokeWidth={2.5} className="text-green" />
          ) : (
            <Copy size={12} strokeWidth={2.2} />
          )}
          {copied ? "Copied" : "Copy answer"}
        </button>
        <PinButton pinned={pinned} onClick={onPin} labelled />
      </div>
    </section>
  );
}

function PinButton({
  pinned,
  onClick,
  labelled,
}: {
  pinned: boolean;
  onClick: () => void;
  labelled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin" : "Pin this"}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-chip px-2 text-[11.5px] font-medium transition-colors",
        pinned
          ? "bg-accent-tint text-accent-ink"
          : "text-ink-3 opacity-0 hover:bg-hover hover:text-ink focus-visible:opacity-100 group-hover:opacity-100",
      )}
    >
      <Pin size={12} strokeWidth={2.2} fill={pinned ? "currentColor" : "none"} />
      {labelled ? (pinned ? "Pinned" : "Pin") : null}
    </button>
  );
}
