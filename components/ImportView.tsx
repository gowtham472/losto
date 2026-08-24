"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Image as ImageIcon,
  Link2,
  Loader2,
  Sparkles,
  Users,
  Type,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { AssetProvider } from "@/components/Media";
import { SourceMark } from "@/components/SourceMark";
import {
  Button,
  Card,
  Field,
  Label,
  SectionTitle,
  Segmented,
  TextArea,
  Well,
} from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import type { DownloadProgress } from "@/lib/assets";
import { dedupeAssets, rewriteMedia } from "@/lib/media";
import { splitPastedTranscript, titleFromPaste } from "@/lib/paste";
import { COLLECTION_COLORS, SOURCES, detectSource, sourceInfo } from "@/lib/sources";
import { useLibrary, useOnline } from "@/lib/store";
import type { Asset, ExtractError, ExtractResult, SourceId } from "@/lib/types";
import { cn, countWords, extractUrls, formatBytes, readClipboard, readingMinutes } from "@/lib/utils";

type Item = {
  url: string;
  status: "queued" | "working" | "done" | "failed";
  result?: ExtractResult;
  error?: ExtractError;
};

const FETCHED = ["chatgpt", "claude", "perplexity"] as const;

export function ImportView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const online = useOnline();
  const { collections, saveExtracted, addCollection } = useLibrary();

  const [mode, setMode] = useState<"link" | "text">("link");
  // The Android share sheet lands here with the link in a query parameter.
  const [input, setInput] = useState(() => params.get("url") ?? params.get("text") ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<DownloadProgress | null>(null);
  const [pasteGuide, setPasteGuide] = useState<{ source: SourceId; code: string } | null>(
    null,
  );

  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteBody, setPasteBody] = useState("");

  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const links = useMemo(() => extractUrls(input).slice(0, 10), [input]);
  const singleSource = links.length === 1 ? detectSource(links[0]) : null;
  const ready = items.filter((i) => i.status === "done" && i.result);
  const failed = items.filter((i) => i.status === "failed");

  const extract = async () => {
    if (!links.length) return;
    setBusy(true);
    const queue: Item[] = links.map((url) => ({ url, status: "queued" }));
    setItems(queue);

    for (let i = 0; i < queue.length; i++) {
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "working" } : it)));
      try {
        const response = await fetch("/api/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: queue[i].url }),
        });
        const data = (await response.json()) as ExtractResult | ExtractError;
        // Some conversations simply cannot be read from a link - the page is
        // rendered in the browser, or the site turns automated requests away.
        // Offer the copy-across route rather than leaving a dead end.
        if (!data.ok && needsPaste(data as ExtractError)) {
          const failure = data as ExtractError;
          setPasteGuide({ source: failure.source, code: failure.code });
          setItems([]);
          break;
        }
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? data.ok
                ? { ...it, status: "done", result: data as ExtractResult }
                : { ...it, status: "failed", error: data as ExtractError }
              : it,
          ),
        );
      } catch {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "failed",
                  error: {
                    ok: false,
                    code: "network",
                    error: "Could not reach Losto's extractor.",
                    hint: online ? undefined : "You appear to be offline.",
                    source: detectSource(it.url),
                  },
                }
              : it,
          ),
        );
      }
    }
    setBusy(false);
  };

  const parsedTags = () =>
    tags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 8);

  const saveAll = async () => {
    if (!ready.length) return;
    setBusy(true);
    let lastId = "";
    let mediaCount = 0;
    for (const item of ready) {
      if (!item.result) continue;
      mediaCount += item.result.assets?.length ?? 0;
      lastId = await saveExtracted(item.result, {
        collectionId,
        tags: parsedTags(),
        onMedia: setMedia,
      });
    }
    setMedia(null);
    setBusy(false);
    toast.success(
      ready.length === 1 ? "Saved to your device" : `${ready.length} chats saved to your device`,
      mediaCount
        ? `Downloading ${mediaCount} media ${mediaCount === 1 ? "file" : "files"} in the background - read on while it finishes.`
        : "Available offline from now on.",
    );
    router.push(ready.length === 1 ? `/chat?id=${lastId}` : "/library");
  };

  const savePasted = async () => {
    const parsed = splitPastedTranscript(pasteBody);
    if (!parsed.length) {
      toast.error("Nothing to save", "Paste the chat text first.");
      return;
    }

    // Pasted markdown gets the same media treatment as a fetched chat, so any
    // pictures or clips in it are stored for offline too.
    const all: Asset[] = [];
    const messages = parsed.map((message) => {
      const { markdown, assets } = rewriteMedia(message.content);
      all.push(...assets);
      return { ...message, content: markdown, assets: assets.length ? assets : undefined };
    });

    setBusy(true);
    const id = await saveExtracted(
      {
        ok: true,
        title: pasteTitle.trim() || titleFromPaste(pasteBody),
        source: "manual",
        sourceUrl: "",
        messages,
        strategy: "manual:paste",
        assets: all.length ? dedupeAssets(all) : undefined,
      },
      { collectionId, tags: parsedTags(), onMedia: setMedia },
    );
    setBusy(false);
    toast.success("Saved to your device");
    router.push(`/chat?id=${id}`);
  };

  const createSubject = async () => {
    const name = newSubject.trim();
    if (!name) return;
    const created = await addCollection({
      name,
      color: ["blue", "green", "orange", "violet", "red"][collections.length % 5],
      emoji: "",
    });
    setCollectionId(created.id);
    setNewSubject("");
  };

  return (
    <>
      <PageHeader
        title="Add a chat"
        subtitle="Paste a share link - Losto pulls the whole conversation onto this device."
      />

      <div className="mx-auto max-w-3xl space-y-5 px-4 lg:px-8">
        {!online ? (
          <Well className="flex items-start gap-2.5 p-3">
            <WifiOff size={15} strokeWidth={2.1} className="mt-px shrink-0 text-orange" />
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              You are offline, so new links cannot be fetched right now. You can still paste chat
              text below and save it - everything already in your library stays readable.
            </p>
          </Well>
        ) : null}

        <Segmented
          value={mode}
          onChange={(v) => setMode(v)}
          className="w-full [&>button]:flex-1"
          options={[
            {
              value: "link",
              label: (
                <>
                  <Link2 size={13} strokeWidth={2.2} /> Share link
                </>
              ),
            },
            {
              value: "text",
              label: (
                <>
                  <Type size={13} strokeWidth={2.2} /> Paste text
                </>
              ),
            },
          ]}
        />

        {mode === "link" ? (
          <Card className="p-3">
            <div className="relative">
              <TextArea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder={"https://chatgpt.com/share/…\n\nPaste one link, or several at once."}
                className="pr-11 font-mono text-[12.5px]"
                aria-label="Share links"
              />
              <button
                type="button"
                title="Paste from clipboard"
                onClick={async () => {
                  const text = await readClipboard();
                  if (text) setInput((prev) => (prev ? `${prev}\n${text}` : text));
                  else toast.error("Clipboard blocked", "Paste with your keyboard instead.");
                }}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-chip bg-surface text-ink-2 shadow-btn transition-colors hover:bg-hover hover:text-ink"
              >
                <ClipboardPaste size={13} strokeWidth={2.2} />
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {links.length ? (
                <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
                  {singleSource ? <SourceMark source={singleSource} size="sm" /> : null}
                  {links.length === 1
                    ? `${sourceInfo(singleSource ?? "unknown").label} link detected`
                    : `${links.length} links detected`}
                </span>
              ) : (
                <span className="text-[12px] text-ink-3">
                  Works with {FETCHED.map((s) => SOURCES[s].label).join(", ")}, blogs and docs. Anything Losto
                  cannot read, it will show you how to paste.
                </span>
              )}
              <Button
                variant="primary"
                size="lg"
                className="ml-auto"
                disabled={!links.length || busy || !online}
                onClick={extract}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {busy ? "Fetching…" : "Fetch chat"}
                {!busy ? <ArrowRight size={14} strokeWidth={2.4} /> : null}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="space-y-3 p-3">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Field
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Unit 3 - Thermodynamics answers"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Chat text</Label>
              <TextArea
                ref={pasteRef}
                value={pasteBody}
                onChange={(e) => setPasteBody(e.target.value)}
                rows={10}
                placeholder={
                  "Paste the whole conversation here.\n\nIf it still has \"You said:\" and \"ChatGPT said:\" markers, Losto splits it into questions and answers automatically. Markdown, tables and code blocks are kept."
                }
                className="text-[13px]"
              />
              <p className="text-[11px] text-ink-3">
                {countWords(pasteBody)} words · about {readingMinutes(countWords(pasteBody))} min to
                read
              </p>
            </div>
          </Card>
        )}

        {/* filing */}
        {(mode === "text" && pasteBody.trim()) || ready.length ? (
          <Card className="space-y-3.5 p-3">
            <SectionTitle index="01">File it away</SectionTitle>

            <div className="space-y-1.5">
              <Label>Subject</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCollectionId(null)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                    collectionId === null
                      ? "bg-ink text-page shadow-btn"
                      : "bg-surface text-ink-2 shadow-btn hover:bg-hover",
                  )}
                >
                  Unsorted
                </button>
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    type="button"
                    onClick={() => setCollectionId(collection.id)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
                      collectionId === collection.id
                        ? "bg-ink text-page shadow-btn"
                        : "bg-surface text-ink-2 shadow-btn hover:bg-hover",
                    )}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        background:
                          collectionId === collection.id
                            ? "currentColor"
                            : (COLLECTION_COLORS[collection.color] ?? "var(--ink-3)"),
                      }}
                    />
                    {collection.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 pt-1">
                <Field
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createSubject();
                    }
                  }}
                  placeholder="New subject…"
                  className="h-8 text-[12.5px]"
                />
                <Button size="md" onClick={createSubject} disabled={!newSubject.trim()}>
                  Create
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Field
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="unit-3, exam, important"
                className="h-8 text-[12.5px]"
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={mode === "text" ? savePasted : saveAll}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              {mode === "text"
                ? "Save to my device"
                : ready.length === 1
                  ? "Save to my device"
                  : `Save ${ready.length} chats to my device`}
            </Button>

            {media && media.total ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11.5px] text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon size={12} strokeWidth={2.2} className="text-ink-3" />
                    Copying media for offline
                  </span>
                  <span className="font-mono tabnums text-ink-3">
                    {media.done}/{media.total} · {formatBytes(media.bytes)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-200"
                    style={{ width: `${Math.round((media.done / media.total) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}

        {/* results */}
        {items.length ? (
          <section className="space-y-2 pb-8">
            <SectionTitle index="02">
              {busy
                ? "Fetching…"
                : `${ready.length} of ${items.length} ready${failed.length ? ` · ${failed.length} failed` : ""}`}
            </SectionTitle>
            {items.map((item) => (
              <ResultRow
                key={item.url}
                item={item}
                expanded={items.length === 1}
                onRetry={() => extract()}
                onManual={() => {
                  setMode("text");
                  setItems([]);
                }}
                onDismiss={() =>
                  setItems((prev) => prev.filter((entry) => entry.url !== item.url))
                }
              />
            ))}
          </section>
        ) : null}

        {!items.length && mode === "link" ? <HowItWorks /> : null}
      </div>

      <PasteGuide
        guide={pasteGuide}
        onClose={() => setPasteGuide(null)}
        onSwitch={() => {
          setPasteGuide(null);
          setMode("text");
          setItems([]);
          // Give the panel a frame to mount before reaching for the field.
          requestAnimationFrame(() => pasteRef.current?.focus());
        }}
      />
    </>
  );
}

/**
 * Whether a failed link is worth offering the copy-across route for.
 *
 * A chat that could not be read is almost always a page rendered in the reader's
 * own browser, or a site that turns automated requests away - both fixed by
 * pasting. A deleted or private link is not, so those keep their own message.
 */
function needsPaste(error: ExtractError): boolean {
  if (error.source === "unknown" || error.source === "manual") return false;
  return ["paste_only", "empty", "blocked", "unsupported"].includes(error.code);
}

/** Says what actually happened, rather than one guess stretched over four cases. */
function whyNotFetched(code: string, label: string): string {
  switch (code) {
    case "blocked":
      return `${label} turned the request away. Losto will not try to get around that, so the conversation has to come across by hand.`;
    case "paste_only":
      return `Losto no longer fetches ${label} conversations. Copying it across works just as well.`;
    case "unsupported":
      return `Losto cannot read that kind of ${label} link yet. Copying it across works today.`;
    default:
      return `Losto could not find a conversation at that link. ${label} usually builds the chat in your browser after the page loads, so a page fetched by a server is empty.`;
  }
}

/**
 * Shown when a conversation cannot be read from its link. It says what happened
 * in one line, gives the steps, and drops the reader into the paste field - a
 * dead end otherwise.
 */
function PasteGuide({
  guide,
  onClose,
  onSwitch,
}: {
  guide: { source: SourceId; code: string } | null;
  onClose: () => void;
  onSwitch: () => void;
}) {
  if (!guide) return null;
  const { source, code } = guide;
  const info = sourceInfo(source);
  const steps = info.pasteSteps ?? [
    "Open the conversation in your browser.",
    "Select the whole thing and copy it.",
    "Come back here, switch to Paste text, and paste.",
  ];

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Copy this ${info.label} chat across`}
      description={whyNotFetched(code, info.label)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSwitch}>
            <Type size={14} strokeWidth={2.2} />
            Switch to Paste text
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Well className="flex items-start gap-2.5 p-3">
          <SourceMark source={guide.source} size="md" />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Your browser can see it even though Losto cannot. Copy it across and everything is kept
            - formatting, code blocks, tables and maths, exactly as they were.
          </p>
        </Well>

        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] font-semibold text-ink-2 shadow-hairline">
                {index + 1}
              </span>
              <span className="text-[13px] leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>

        <p className="text-[11.5px] leading-relaxed text-ink-3">
          If the chat still has “You said:” and “{info.label} said:” markers, Losto splits it back
          into questions and answers automatically.
        </p>
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */

function ResultRow({
  item,
  expanded,
  onRetry,
  onManual,
  onDismiss,
}: {
  item: Item;
  expanded: boolean;
  onRetry: () => void;
  onManual: () => void;
  onDismiss: () => void;
}) {
  const source = item.result?.source ?? item.error?.source ?? detectSource(item.url);
  const words = item.result?.messages.reduce((sum, m) => sum + countWords(m.content), 0) ?? 0;
  const preview = item.result?.messages.slice(0, 2) ?? [];
  const mediaCount = item.result?.assets?.length ?? 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-2.5 p-3">
        <SourceMark source={source} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
            {item.result?.title ?? item.error?.error ?? "Fetching…"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-3">{item.url}</p>

          {item.status === "done" && item.result ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-2">
              <span className="flex items-center gap-1 text-green">
                <CheckCircle2 size={11} strokeWidth={2.4} /> Ready
              </span>
              <span>{item.result.messages.length} turns</span>
              <span>{words.toLocaleString()} words</span>
              <span>{readingMinutes(words)} min read</span>
              {mediaCount ? (
                <span className="flex items-center gap-1 text-accent-ink">
                  <ImageIcon size={11} strokeWidth={2.4} />
                  {mediaCount} media
                </span>
              ) : null}
              {item.result.model ? <span className="font-mono">{item.result.model}</span> : null}
            </p>
          ) : null}

          {item.status === "failed" && item.error ? (
            <div className="mt-1.5 space-y-2">
              <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-2">
                <AlertTriangle size={12} strokeWidth={2.3} className="mt-px shrink-0 text-red" />
                <span>{item.error.hint ?? "Losto could not read that link."}</span>
              </p>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={onRetry}>
                  Try again
                </Button>
                <Button size="sm" variant="subtle" onClick={onManual}>
                  Paste the text instead
                </Button>
              </div>
            </div>
          ) : null}

          {item.result?.warning ? (
            <p className="mt-1.5 rounded-chip bg-orange-tint px-2 py-1 text-[11px] leading-relaxed text-orange">
              {item.result.warning}
            </p>
          ) : null}
        </div>

        {item.status === "working" ? (
          <Loader2 size={14} className="mt-1 shrink-0 animate-spin text-ink-3" />
        ) : (
          <button
            type="button"
            aria-label="Remove"
            onClick={onDismiss}
            className="flex size-7 shrink-0 items-center justify-center rounded-chip text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          >
            <X size={13} strokeWidth={2.4} />
          </button>
        )}
      </div>

      {expanded && preview.length ? (
        <AssetProvider assets={item.result?.assets}>
          <div className="max-h-80 space-y-3 overflow-y-auto border-t border-line bg-inset p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Preview
            </p>
            {preview.map((message) => (
              <div key={message.id} className="space-y-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {message.role === "user" ? "Question" : "Answer"}
                </p>
                <Markdown content={message.content.slice(0, 1200)} className="text-[13px]" />
              </div>
            ))}
          </div>
        </AssetProvider>
      ) : null}
    </Card>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Share the chat",
      body: "In ChatGPT, Claude or any assistant, tap Share and copy the link. Any blog or docs URL works too.",
    },
    {
      title: "Paste it here",
      body: "Losto keeps the full conversation - every answer, code block, table and formula. If a link cannot be read, it shows you how to copy it across instead.",
    },
    {
      title: "Read it anywhere",
      body: "It is stored on this device. No signal needed, no account, nothing uploaded.",
    },
  ];

  return (
    <section className="pb-8">
      <SectionTitle index="01">How it works</SectionTitle>
      <Well className="divide-y divide-line">
        {steps.map((step, index) => (
          <div key={step.title} className="flex gap-3 p-3">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] font-semibold text-ink-2 shadow-hairline">
              {index + 1}
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-ink">{step.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{step.body}</p>
            </div>
          </div>
        ))}
      </Well>
      <p className="mt-3 flex items-start gap-1.5 px-1 text-[11.5px] leading-relaxed text-ink-3">
        <Sparkles size={12} strokeWidth={2.2} className="mt-px shrink-0" />
        <span>
          On Android you can also share a link straight from an assistant app or your browser into
          Losto once it is
          installed to your home screen. <Link href="/settings" className="underline">Install it here.</Link>
        </span>
      </p>
      <p className="mt-1.5 flex items-start gap-1.5 px-1 text-[11.5px] leading-relaxed text-ink-3">
        <Users size={12} strokeWidth={2.2} className="mt-px shrink-0" />
        <span>
          Someone next to you already has the chat?{" "}
          <Link href="/receive" className="underline">
            Take it from their phone
          </Link>{" "}
          - no internet needed.
        </span>
      </p>
    </section>
  );
}
