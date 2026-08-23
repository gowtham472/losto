"use client";

import { Check, Download, ExternalLink, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toMarkdownDocument } from "@/lib/markdown";
import { COLLECTION_COLORS, sourceInfo } from "@/lib/sources";
import { useLibrary } from "@/lib/store";
import type { ChatMeta } from "@/lib/types";
import { cn, copyText, downloadFile, slugify } from "@/lib/utils";
import { Button, Field, Label } from "./ui/primitives";
import { Confirm, Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";

export function ChatActions({
  chat,
  onClose,
  onDeleted,
}: {
  chat: ChatMeta | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  if (!chat) return null;
  // Keying on the id restarts the form for each chat, so no reset effect.
  return <ChatActionsSheet key={chat.id} chat={chat} onClose={onClose} onDeleted={onDeleted} />;
}

function ChatActionsSheet({
  chat,
  onClose,
  onDeleted,
}: {
  chat: ChatMeta;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const { collections, updateChat, removeChats, loadBody } = useLibrary();
  const toast = useToast();
  const [title, setTitle] = useState(chat.title);
  const [tags, setTags] = useState(chat.tags.join(", "));
  const [confirming, setConfirming] = useState(false);

  const commit = async () => {
    const nextTags = tags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 8);
    const nextTitle = title.trim() || chat.title;
    if (nextTitle !== chat.title || nextTags.join() !== chat.tags.join()) {
      await updateChat(chat.id, { title: nextTitle, tags: nextTags });
    }
    onClose();
  };

  const exportMarkdown = async () => {
    const messages = await loadBody(chat.id);
    const doc = toMarkdownDocument(
      chat.title,
      { source: sourceInfo(chat.source).label, url: chat.sourceUrl, savedAt: chat.savedAt },
      messages,
    );
    downloadFile(`${slugify(chat.title)}.md`, doc, "text/markdown");
    toast.success("Markdown file saved");
  };

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title="Chat options"
        description={chat.title}
        footer={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={commit}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Field value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <div className="flex flex-wrap gap-1.5">
              <SubjectPill
                active={chat.collectionId === null}
                onClick={() => updateChat(chat.id, { collectionId: null })}
                label="Unsorted"
              />
              {collections.map((collection) => (
                <SubjectPill
                  key={collection.id}
                  active={chat.collectionId === collection.id}
                  onClick={() => updateChat(chat.id, { collectionId: collection.id })}
                  label={collection.name}
                  color={COLLECTION_COLORS[collection.color]}
                  emoji={collection.emoji}
                />
              ))}
            </div>
            {!collections.length ? (
              <p className="text-[11.5px] text-ink-3">
                No subjects yet - create them on the Subjects tab.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Field
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="unit-3, important, exam"
            />
            <p className="text-[11px] text-ink-3">Separate with commas. Up to 8.</p>
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <Row
              icon={<Download size={14} strokeWidth={2.1} />}
              label="Export as Markdown"
              onClick={exportMarkdown}
            />
            <Row
              icon={<Link2 size={14} strokeWidth={2.1} />}
              label="Copy original link"
              disabled={!chat.sourceUrl}
              onClick={async () => {
                if (await copyText(chat.sourceUrl)) toast.success("Link copied");
              }}
            />
            <Row
              icon={<ExternalLink size={14} strokeWidth={2.1} />}
              label="Open original chat"
              disabled={!chat.sourceUrl}
              onClick={() => window.open(chat.sourceUrl, "_blank", "noopener")}
            />
            <Row
              icon={<Trash2 size={14} strokeWidth={2.1} />}
              label="Delete from this device"
              tone="danger"
              onClick={() => setConfirming(true)}
            />
          </div>
        </div>
      </Sheet>

      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this chat?"
        description={`"${chat.title}" will be removed from this device. This cannot be undone unless you have a backup.`}
        onConfirm={async () => {
          await removeChats([chat.id]);
          toast.success("Chat deleted");
          onDeleted?.(chat.id);
          onClose();
        }}
      />
    </>
  );
}

function SubjectPill({
  active,
  label,
  color,
  emoji,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  emoji?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
        active ? "bg-ink text-page shadow-btn" : "bg-surface text-ink-2 shadow-btn hover:bg-hover",
      )}
    >
      {color ? (
        <span className="size-1.5 rounded-full" style={{ background: color }} />
      ) : null}
      {emoji ? <span className="text-[11px]">{emoji}</span> : null}
      {label}
      {active ? <Check size={11} strokeWidth={3} /> : null}
    </button>
  );
}

function Row({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-full items-center gap-2.5 rounded-control px-2 text-[13px] font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-40",
        tone === "danger" ? "text-red hover:bg-red-tint" : "text-ink hover:bg-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
