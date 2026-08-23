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
import * as db from "./db";
import type {
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
}

interface LibraryValue {
  ready: boolean;
  error: string | null;
  chats: ChatMeta[];
  collections: Collection[];
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveExtracted: (result: ExtractResult, options?: SaveOptions) => Promise<string>;
  updateChat: (id: string, patch: Partial<ChatMeta>) => Promise<void>;
  updateMessages: (id: string, messages: ChatMessage[]) => Promise<void>;
  removeChats: (ids: string[]) => Promise<void>;
  loadBody: (id: string) => Promise<ChatMessage[]>;
  allBodies: () => Promise<ChatBody[]>;
  addCollection: (input: { name: string; color: string; emoji: string }) => Promise<Collection>;
  updateCollection: (id: string, patch: Partial<Collection>) => Promise<void>;
  removeCollection: (id: string) => Promise<void>;
  exportBackup: () => Promise<BackupFile>;
  importBackup: (file: BackupFile) => Promise<{ chats: number; collections: number }>;
  wipe: () => Promise<void>;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const bodyCache = useRef(new Map<string, ChatMessage[]>());

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

  const saveExtracted = useCallback<LibraryValue["saveExtracted"]>(async (result, options = {}) => {
    const id = uid("c");
    const now = Date.now();
    const messages = result.messages;
    const words = messages.reduce((sum, m) => sum + countWords(m.content), 0);

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
    };

    await db.putChat(meta, { id, messages });
    bodyCache.current.set(id, messages);
    setChats((prev) => [meta, ...prev]);
    return id;
  }, []);

  const updateChat = useCallback<LibraryValue["updateChat"]>(async (id, patch) => {
    let next: ChatMeta | undefined;
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        next = { ...c, ...patch, updatedAt: Date.now() };
        return next;
      }),
    );
    const current = next ?? (await db.getChat(id));
    if (current) await db.putChat({ ...current, ...patch, updatedAt: Date.now() });
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

  const importBackup = useCallback<LibraryValue["importBackup"]>(async (file) => {
    if (file?.app !== "losto" || !Array.isArray(file.chats)) {
      throw new Error("That file is not a Losto backup.");
    }
    const existing = await db.getAllChats();
    const known = new Set(existing.map((c) => c.id));
    const knownUrls = new Set(existing.map((c) => `${c.source}|${c.sourceUrl}`));

    const metas: ChatMeta[] = [];
    const bodies: ChatBody[] = [];
    for (const chat of file.chats) {
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
    const newCollections = (file.collections ?? []).filter((c) => !collectionIds.has(c.id));

    if (newCollections.length) await db.putCollections(newCollections);
    if (metas.length) await db.putChats(metas, bodies);

    setChats(await db.getAllChats());
    setCollections((await db.getCollections()).sort((a, b) => a.order - b.order));
    return { chats: metas.length, collections: newCollections.length };
  }, []);

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
      setSetting,
      saveExtracted,
      updateChat,
      updateMessages,
      removeChats,
      loadBody,
      allBodies,
      addCollection,
      updateCollection,
      removeCollection,
      exportBackup,
      importBackup,
      wipe,
    }),
    [
      ready,
      error,
      chats,
      collections,
      settings,
      setSetting,
      saveExtracted,
      updateChat,
      updateMessages,
      removeChats,
      loadBody,
      allBodies,
      addCollection,
      updateCollection,
      removeCollection,
      exportBackup,
      importBackup,
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
