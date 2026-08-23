"use client";

import { FolderPlus, MoreHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Label,
  Skeleton,
} from "@/components/ui/primitives";
import { Confirm, Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import {
  COLLECTION_COLORS,
  COLLECTION_COLOR_KEYS,
  STARTER_COLLECTIONS,
} from "@/lib/sources";
import { useLibrary } from "@/lib/store";
import type { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJI_CHOICES = ["", "∑", "⚛", "⚗", "⌘", "★", "🧠", "📐", "🧬", "💡", "🗂", "🧾"];

export function CollectionsView() {
  const { ready, chats, collections, addCollection, updateCollection, removeCollection } =
    useLibrary();
  const toast = useToast();
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, { chats: number; minutes: number }>();
    for (const chat of chats) {
      if (chat.archived) continue;
      const key = chat.collectionId ?? "none";
      const entry = map.get(key) ?? { chats: 0, minutes: 0 };
      entry.chats += 1;
      entry.minutes += chat.readMinutes;
      map.set(key, entry);
    }
    return map;
  }, [chats]);

  const unsorted = counts.get("none")?.chats ?? 0;

  const addStarters = async () => {
    for (const starter of STARTER_COLLECTIONS) {
      await addCollection(starter);
    }
    toast.success("Starter subjects created");
  };

  return (
    <>
      <PageHeader
        title="Subjects"
        subtitle="Group saved chats by module, paper or unit."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <FolderPlus size={14} strokeWidth={2.3} />
            New subject
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-2.5 px-4 pb-10 lg:px-8">
        {!ready ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))
        ) : collections.length ? (
          <>
            {collections.map((collection, index) => {
              const stat = counts.get(collection.id) ?? { chats: 0, minutes: 0 };
              return (
                <Card key={collection.id} className="flex items-center gap-3 p-3">
                  <Link
                    href={`/?collection=${collection.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="font-mono text-[10.5px] tabnums text-ink-3">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[15px]"
                      style={{
                        background: `color-mix(in oklch, ${COLLECTION_COLORS[collection.color] ?? "var(--ink-3)"} 14%, var(--surface))`,
                        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${COLLECTION_COLORS[collection.color] ?? "var(--ink-3)"} 24%, transparent)`,
                        color: COLLECTION_COLORS[collection.color] ?? "var(--ink-3)",
                      }}
                    >
                      {collection.emoji || collection.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold tracking-[-0.015em] text-ink">
                        {collection.name}
                      </span>
                      <span className="block text-[11.5px] text-ink-2">
                        {stat.chats} {stat.chats === 1 ? "chat" : "chats"} · {stat.minutes} min of
                        reading
                      </span>
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Options for ${collection.name}`}
                    onClick={() => setEditing(collection)}
                  >
                    <MoreHorizontal size={14} strokeWidth={2.2} />
                  </Button>
                </Card>
              );
            })}

            {unsorted ? (
              <Link
                href="/"
                className="flex items-center gap-3 rounded-card bg-inset p-3 shadow-hairline transition-colors hover:bg-hover"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-ink-3 shadow-hairline">
                  ?
                </span>
                <span>
                  <span className="block text-[13.5px] font-semibold text-ink">Unsorted</span>
                  <span className="block text-[11.5px] text-ink-2">
                    {unsorted} {unsorted === 1 ? "chat" : "chats"} with no subject yet
                  </span>
                </span>
              </Link>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon={<FolderPlus size={18} strokeWidth={2} />}
            title="No subjects yet"
            description="Subjects keep the library usable once you have fifty chats saved. Start with the common ones or make your own."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => setEditing("new")}>
                  Create a subject
                </Button>
                <Button onClick={addStarters}>
                  <Sparkles size={13} strokeWidth={2.2} />
                  Use starter set
                </Button>
              </div>
            }
          />
        )}
      </div>

      <CollectionEditor
        target={editing}
        onClose={() => setEditing(null)}
        onSave={async (values) => {
          if (editing === "new") {
            await addCollection(values);
            toast.success("Subject created");
          } else if (editing) {
            await updateCollection(editing.id, values);
          }
          setEditing(null);
        }}
        onDelete={(collection) => {
          setEditing(null);
          setDeleting(collection);
        }}
      />

      <Confirm
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="The subject is removed, but the chats inside it stay in your library as unsorted."
        confirmLabel="Delete subject"
        onConfirm={async () => {
          if (deleting) {
            await removeCollection(deleting.id);
            toast.success("Subject deleted");
          }
        }}
      />
    </>
  );
}

function CollectionEditor({
  target,
  onClose,
  onSave,
  onDelete,
}: {
  target: Collection | "new" | null;
  onClose: () => void;
  onSave: (values: { name: string; color: string; emoji: string }) => void;
  onDelete: (collection: Collection) => void;
}) {
  const isNew = target === "new";
  const existing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [emoji, setEmoji] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  // Reseed the form whenever a different subject is opened.
  const key = existing?.id ?? (isNew ? "new" : "");
  if (target && seeded !== key) {
    setSeeded(key);
    setName(existing?.name ?? "");
    setColor(existing?.color ?? "blue");
    setEmoji(existing?.emoji ?? "");
  }

  if (!target) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "New subject" : "Edit subject"}
      footer={
        <>
          {existing ? (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(existing)}>
              Delete
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => onSave({ name, color, emoji })}
          >
            {isNew ? "Create" : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Field
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Engineering Mathematics II"
            maxLength={40}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-1.5">
            {COLLECTION_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={color === key}
                onClick={() => setColor(key)}
                className={cn(
                  "size-7 rounded-full transition-transform",
                  color === key ? "scale-110 shadow-btn" : "opacity-70 hover:opacity-100",
                )}
                style={{
                  background: COLLECTION_COLORS[key],
                  boxShadow:
                    color === key ? "0 0 0 2px var(--surface), 0 0 0 4px currentColor" : undefined,
                  color: COLLECTION_COLORS[key],
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Symbol</Label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((choice) => (
              <button
                key={choice || "none"}
                type="button"
                onClick={() => setEmoji(choice)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-control text-[14px] transition-colors",
                  emoji === choice
                    ? "bg-ink text-page shadow-btn"
                    : "bg-surface text-ink-2 shadow-btn hover:bg-hover",
                )}
              >
                {choice || <span className="text-[10px] font-medium">None</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
