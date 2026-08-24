"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type DownloadOutcome, type DownloadProgress, downloadAssets } from "./assets";
import { type Bundle, asBundle, buildBundle, storeBundleAssets } from "./bundle";
import { buildChecklist } from "./checklist";
import * as db from "./db";
import { originIconAsset } from "./media";
import type {
  Asset,
  BackupFile,
  ChatBody,
  ChatMessage,
  ChatMeta,
  Collection,
  ExtractResult,
  Settings,
} from "./types";
import { buildExcerpt, countWords, readingMinutes, uid } from "./utils";

const SETTINGS_KEY = "losto:settings";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  readerSize: 15,
  readerTypeface: "sans",
  readerLayout: "chat",
  showThinking: false,
  density: "comfortable",
  sort: "recent",
  view: "grid",
  media: "all",
  maxAssetMB: 25,
};

export function loadSettings(): Settings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#1b1c1f" : "#fbfbfc");
}

interface SaveOptions {
  collectionId?: string | null;
  tags?: string[];
  title?: string;
  note?: string;
  /** Called while the pictures and clips are copied onto the device. */
  onMedia?: (progress: DownloadProgress) => void;
}

interface LibraryValue {
  ready: boolean;
  error: string | null;
  chats: ChatMeta[];
  collections: Collection[];
  settings: Settings;
  /** Media downloads still running, keyed by chat id. */
  mediaJobs: Record<string, DownloadProgress>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveExtracted: (result: ExtractResult, options?: SaveOptions) => Promise<string>;
  /**
   * Patch a chat record. Pass a function to derive the patch from the stored
   * record - required for anything that edits a list in place (ticks, pins),
   * because two taps in one frame would otherwise both read the same "before".
   */
  updateChat: (
    id: string,
    patch: Partial<ChatMeta> | ((current: ChatMeta) => Partial<ChatMeta>),
  ) => Promise<void>;
  updateMessages: (id: string, messages: ChatMessage[]) => Promise<void>;
  removeChats: (ids: string[]) => Promise<void>;
  refetchMedia: (
    id: string,
    onProgress?: (progress: DownloadProgress) => void,
  ) => Promise<DownloadOutcome>;
  loadBody: (id: string) => Promise<ChatMessage[]>;
  allBodies: () => Promise<ChatBody[]>;
  addCollection: (input: { name: string; color: string; emoji: string }) => Promise<Collection>;
  updateCollection: (id: string, patch: Partial<Collection>) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  exportBackup: () => Promise<BackupFile>;
  importBackup: (file: BackupFile) => Promise<ImportCount>;
  /** Packs chats for handing to another device. */
  exportChats: (ids: string[], options?: { media?: boolean }) => Promise<Bundle>;
  importBundle: (bundle: Bundle) => Promise<ImportCount>;
  wipe: () => Promise<void>;
}

interface ImportCount {
  chats: number;
  collections: number;
  media: number;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [mediaJobs, setMediaJobs] = useState<Record<string, DownloadProgress>>({});
  const bodyCache = useRef(new Map<string, ChatMessage[]>());
  // One chain per chat, so overlapping writes to the same record are applied in
  // order instead of racing each other through a read-modify-write.
  const writes = useRef(new Map<string, Promise<unknown>>());

  useEffect(() => {
    // Settings live in localStorage, which cannot be read while rendering on the
    // server. Seeding them here rather than in a lazy initialiser is what keeps
    // the first client render identical to the prerendered HTML.
    const stored = loadSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(stored);
    applyTheme(stored.theme);

    let cancelled = false;
    (async () => {
      try {
        const [c, f] = await Promise.all([db.getAllChats(), db.getCollections()]);
        if (cancelled) return;
        setChats(c);
        setCollections(f.sort((a, b) => a.order - b.order));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? `Local storage is unavailable (${err.message}). Private browsing can block it.`
              : "Local storage is unavailable.",
          );
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow the OS when the user has not pinned a theme.
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings.theme]);

  const setSetting = useCallback<LibraryValue["setSetting"]>((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked - settings stay in memory */
      }
      if (key === "theme") applyTheme(next.theme);
      return next;
    });
  }, []);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  /**
   * Folds a finished media download into the stored chat record.
   */
  const applyMedia = useCallback(
    async (id: string, assets: Asset[], media: DownloadOutcome, faviconId?: string) => {
    const meta = await db.getChat(id);
    if (!meta) return;
    const merged = Array.from(new Set([...(meta.assetIds ?? []), ...media.stored]));
    const updated: ChatMeta = {
      ...meta,
      assetIds: merged.length ? merged : undefined,
      coverAssetId:
        meta.coverAssetId ??
        assets.find(
          (a) => a.kind === "image" && a.id !== faviconId && media.stored.includes(a.id),
        )?.id,
      faviconAssetId:
        meta.faviconAssetId ??
        (faviconId && media.stored.includes(faviconId) ? faviconId : undefined),
      mediaBytes: (meta.mediaBytes ?? 0) + media.bytes || undefined,
      missingMedia: media.skipped.filter((s) => s.reason !== "policy").length || undefined,
      updatedAt: Date.now(),
    };
    await db.putChat(updated);
    setChats((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [],
  );

  const saveExtracted = useCallback<LibraryValue["saveExtracted"]>(
    async (result, options = {}) => {
      const id = uid("c");
      const now = Date.now();
      const messages = result.messages;
      const words = messages.reduce((sum, m) => sum + countWords(m.content), 0);
      const assets = result.assets ?? [];

      const meta: ChatMeta = {
        id,
        title: (options.title ?? result.title).trim() || "Untitled chat",
        source: result.source,
        sourceUrl: result.sourceUrl,
        model: result.model,
        collectionId: options.collectionId ?? null,
        tags: options.tags ?? [],
        savedAt: now,
        originalAt: result.originalAt,
        updatedAt: now,
        messageCount: messages.length,
        wordCount: words,
        readMinutes: readingMinutes(words),
        favorite: false,
        archived: false,
        progress: 0,
        excerpt: buildExcerpt(messages),
        note: options.note,
        pinned: [],
        studied: [],
        checklistCount: buildChecklist(messages).length || undefined,
      };

      // The words are what matter, so the chat is saved and readable straight
      // away; the pictures stream in behind it and patch the record as they
      // land. A chat with fifty images no longer holds the import hostage.
      await db.putChat(meta, { id, messages });
      bodyCache.current.set(id, messages);
      setChats((prev) => [meta, ...prev]);

      if (assets.length) {
        setMediaJobs((prev) => ({
          ...prev,
          [id]: { done: 0, total: assets.length, bytes: 0 },
        }));

        void downloadAssets(
          assets,
          {
            media: settingsRef.current.media,
            maxAssetMB: settingsRef.current.maxAssetMB,
          },
          (progress) => {
            setMediaJobs((prev) => ({ ...prev, [id]: progress }));
            options.onMedia?.(progress);
          },
        )
          .then((media) => applyMedia(id, assets, media, result.favicon?.id))
          .catch(() => {})
          .finally(() => {
            setMediaJobs((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          });
      }

      return id;
    },
    [applyMedia],
  );

  /** Retries media for a chat whose pictures never made it onto the device. */
  const refetchMedia = useCallback<LibraryValue["refetchMedia"]>(
    async (id, onProgress) => {
      const messages = bodyCache.current.get(id) ?? (await db.getBody(id))?.messages ?? [];
      const existing = await db.getChat(id);

      // The site icon is not attached to any message, so rebuild it here -
      // this is what repairs items saved before icons existed.
      const icon = existing?.faviconAssetId ? null : originIconAsset(existing?.sourceUrl);
      const assets = [...messages.flatMap((m) => m.assets ?? []), ...(icon ? [icon] : [])];
      if (!assets.length) return { stored: [], skipped: [], bytes: 0 };

      setMediaJobs((prev) => ({ ...prev, [id]: { done: 0, total: assets.length, bytes: 0 } }));
      try {
        const outcome = await downloadAssets(
          assets,
          { media: settingsRef.current.media, maxAssetMB: settingsRef.current.maxAssetMB },
          (progress) => {
            setMediaJobs((prev) => ({ ...prev, [id]: progress }));
            onProgress?.(progress);
          },
        );
        await applyMedia(id, assets, outcome, icon?.id);
        return outcome;
      } finally {
        setMediaJobs((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [applyMedia],
  );

  const updateChat = useCallback<LibraryValue["updateChat"]>(async (id, patch) => {
    const resolve = (current: ChatMeta) =>
      typeof patch === "function" ? patch(current) : patch;

    // Optimistic, so a tick or a pin lands on the same frame as the tap. The
    // updater form means a second tap sees the first one's result.
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...resolve(c), updatedAt: Date.now() } : c)),
    );

    const queued = (writes.current.get(id) ?? Promise.resolve()).then(async () => {
      const stored = await db.getChat(id);
      if (!stored) return;
      const updated: ChatMeta = { ...stored, ...resolve(stored), updatedAt: Date.now() };
      await db.putChat(updated);
      // The stored record is authoritative - it has every queued patch applied.
      setChats((prev) => prev.map((c) => (c.id === id ? updated : c)));
    });
    writes.current.set(
      id,
      queued.catch(() => {}),
    );
    await queued;
  }, []);

  const updateMessages = useCallback<LibraryValue["updateMessages"]>(
    async (id, messages) => {
      bodyCache.current.set(id, messages);
      const words = messages.reduce((sum, m) => sum + countWords(m.content), 0);
      const meta = await db.getChat(id);
      if (!meta) return;
      const updated: ChatMeta = {
        ...meta,
        messageCount: messages.length,
        wordCount: words,
        readMinutes: readingMinutes(words),
        excerpt: buildExcerpt(messages),
        checklistCount: buildChecklist(messages).length || undefined,
        updatedAt: Date.now(),
      };
      await db.putChat(updated, { id, messages });
      setChats((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [],
  );

  const removeChats = useCallback<LibraryValue["removeChats"]>(async (ids) => {
    await db.deleteChats(ids);
    for (const id of ids) bodyCache.current.delete(id);
    setChats((prev) => prev.filter((c) => !ids.includes(c.id)));
    // Blobs no surviving chat points at would otherwise sit there forever.
    await db.pruneAssets().catch(() => 0);
  }, []);

  const loadBody = useCallback<LibraryValue["loadBody"]>(async (id) => {
    const cached = bodyCache.current.get(id);
    if (cached) return cached;
    const body = await db.getBody(id);
    const messages = body?.messages ?? [];
    bodyCache.current.set(id, messages);
    return messages;
  }, []);

  const allBodies = useCallback(() => db.getAllBodies(), []);

  const addCollection = useCallback<LibraryValue["addCollection"]>(async (input) => {
    const collection: Collection = {
      id: uid("f"),
      name: input.name.trim() || "Untitled",
      color: input.color,
      emoji: input.emoji,
      createdAt: Date.now(),
      order: Date.now(),
    };
    await db.putCollection(collection);
    setCollections((prev) => [...prev, collection]);
    return collection;
  }, []);

  const updateCollection = useCallback<LibraryValue["updateCollection"]>(async (id, patch) => {
    let next: Collection | undefined;
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        next = { ...c, ...patch };
        return next;
      }),
    );
    if (next) await db.putCollection(next);
  }, []);

  const removeCollection = useCallback<LibraryValue["removeCollection"]>(async (id) => {
    await db.deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setChats((prev) => prev.map((c) => (c.collectionId === id ? { ...c, collectionId: null } : c)));
  }, []);

  const exportBackup = useCallback<LibraryValue["exportBackup"]>(async () => {
    const [metas, bodies] = await Promise.all([db.getAllChats(), db.getAllBodies()]);
    const byId = new Map(bodies.map((b) => [b.id, b.messages]));
    return {
      app: "losto",
      version: 1,
      exportedAt: Date.now(),
      collections: await db.getCollections(),
      chats: metas.map((m) => ({ ...m, messages: byId.get(m.id) ?? [] })),
    };
  }, []);

  const importBundle = useCallback<LibraryValue["importBundle"]>(async (bundle) => {
    const existing = await db.getAllChats();
    const known = new Set(existing.map((c) => c.id));
    const knownUrls = new Set(existing.map((c) => `${c.source}|${c.sourceUrl}`));

    const metas: ChatMeta[] = [];
    const bodies: ChatBody[] = [];
    for (const chat of bundle.chats) {
      const { messages = [], ...meta } = chat;
      // Re-key anything that would collide, and skip true duplicates.
      if (knownUrls.has(`${meta.source}|${meta.sourceUrl}`) && meta.sourceUrl) continue;
      const id = known.has(meta.id) ? uid("c") : meta.id;
      metas.push({ ...meta, id, pinned: meta.pinned ?? [], tags: meta.tags ?? [] });
      bodies.push({ id, messages });
      known.add(id);
    }

    const currentCollections = await db.getCollections();
    const collectionIds = new Set(currentCollections.map((c) => c.id));
    const newCollections = (bundle.collections ?? []).filter((c) => !collectionIds.has(c.id));

    if (newCollections.length) await db.putCollections(newCollections);
    if (metas.length) await db.putChats(metas, bodies);

    // Pictures go in before the chats, so nothing is ever readable with holes
    // in it - the whole reason a bundle carries its media at all.
    const media = await storeBundleAssets(bundle);

    setChats(await db.getAllChats());
    setCollections((await db.getCollections()).sort((a, b) => a.order - b.order));
    return { chats: metas.length, collections: newCollections.length, media };
  }, []);

  const importBackup = useCallback<LibraryValue["importBackup"]>(
    (file) => importBundle(asBundle(file)),
    [importBundle],
  );

  const exportChats = useCallback<LibraryValue["exportChats"]>(
    async (ids, options = {}) => {
      const wanted = new Set(ids);
      const metas = (await db.getAllChats()).filter((c) => wanted.has(c.id));
      const chats = await Promise.all(
        metas.map(async (meta) => ({
          ...meta,
          messages: bodyCache.current.get(meta.id) ?? (await db.getBody(meta.id))?.messages ?? [],
        })),
      );
      // Only the subjects these chats actually sit in, so sharing one chat does
      // not rearrange somebody else's library.
      const used = new Set(metas.map((m) => m.collectionId).filter(Boolean));
      const collections = (await db.getCollections()).filter((c) => used.has(c.id));

      return buildBundle({
        chats,
        collections,
        withMedia: options.media !== false,
        maxAssetBytes: settingsRef.current.maxAssetMB * 1024 * 1024,
      });
    },
    [],
  );

  /*
   * Items saved before icons existed, or whose icon download failed, show a
   * monogram forever otherwise. One quiet pass fills them in: a single request
   * per site, not per chat, and only when there is a connection to spare.
   */
  const backfilled = useRef(false);
  useEffect(() => {
    if (!ready || backfilled.current) return;
    if (settingsRef.current.media === "none") return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const pending = chats.filter((c) => !c.faviconAssetId && c.sourceUrl);
    if (!pending.length) return;
    backfilled.current = true;

    void (async () => {
      const byIcon = new Map<string, { asset: Asset; chatIds: string[] }>();
      for (const chat of pending) {
        const asset = originIconAsset(chat.sourceUrl);
        if (!asset) continue;
        const entry = byIcon.get(asset.id) ?? { asset, chatIds: [] };
        entry.chatIds.push(chat.id);
        byIcon.set(asset.id, entry);
      }

      const groups = [...byIcon.values()].slice(0, 20);
      if (!groups.length) return;

      const outcome = await downloadAssets(
        groups.map((g) => g.asset),
        { media: "images", maxAssetMB: 2 },
      ).catch(() => null);
      if (!outcome?.stored.length) return;

      const updates: ChatMeta[] = [];
      for (const group of groups) {
        if (!outcome.stored.includes(group.asset.id)) continue;
        for (const chatId of group.chatIds) {
          const meta = await db.getChat(chatId);
          if (!meta || meta.faviconAssetId) continue;
          const next: ChatMeta = {
            ...meta,
            faviconAssetId: group.asset.id,
            assetIds: Array.from(new Set([...(meta.assetIds ?? []), group.asset.id])),
          };
          await db.putChat(next);
          updates.push(next);
        }
      }

      if (updates.length) {
        const byId = new Map(updates.map((u) => [u.id, u]));
        setChats((prev) => prev.map((c) => byId.get(c.id) ?? c));
      }
    })();
  }, [ready, chats]);

  const wipe = useCallback(async () => {
    await db.clearAll();
    bodyCache.current.clear();
    setChats([]);
    setCollections([]);
  }, []);

  const value = useMemo<LibraryValue>(
    () => ({
      ready,
      error,
      chats,
      collections,
      settings,
      mediaJobs,
      setSetting,
      saveExtracted,
      updateChat,
      updateMessages,
      removeChats,
      refetchMedia,
      loadBody,
      allBodies,
      addCollection,
      updateCollection,
      removeCollection,
      exportBackup,
      importBackup,
      exportChats,
      importBundle,
      wipe,
    }),
    [
      ready,
      error,
      chats,
      collections,
      settings,
      mediaJobs,
      setSetting,
      saveExtracted,
      updateChat,
      updateMessages,
      removeChats,
      refetchMedia,
      loadBody,
      allBodies,
      addCollection,
      updateCollection,
      removeCollection,
      exportBackup,
      importBackup,
      exportChats,
      importBundle,
      wipe,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}

/** Reports whether the browser currently has a working connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Subscribes to a CSS media query without tripping over server rendering. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
