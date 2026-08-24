/**
 * IndexedDB layer. Metadata and message bodies live in separate stores so the
 * library list can render hundreds of chats without deserialising every answer.
 */
import type { ChatBody, ChatMeta, Collection } from "./types";

const DB_NAME = "losto";
const DB_VERSION = 2;

export const STORE_CHATS = "chats";
export const STORE_BODIES = "bodies";
export const STORE_COLLECTIONS = "collections";
export const STORE_KV = "kv";
export const STORE_ASSETS = "assets";

/** A downloaded picture or clip, kept as bytes so it survives offline. */
export interface StoredAsset {
  id: string;
  blob: Blob;
  mime: string;
  bytes: number;
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CHATS)) {
        const chats = db.createObjectStore(STORE_CHATS, { keyPath: "id" });
        chats.createIndex("savedAt", "savedAt");
        chats.createIndex("collectionId", "collectionId");
        chats.createIndex("source", "source");
      }
      if (!db.objectStoreNames.contains(STORE_BODIES)) {
        db.createObjectStore(STORE_BODIES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      // Added in v2 — existing libraries upgrade in place, keeping their chats.
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: "id" });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("Could not open database"));
    req.onblocked = () => reject(new Error("Database upgrade blocked by another tab"));
  });

  return dbPromise;
}

function tx<T>(
  store: string | string[],
  mode: IDBTransactionMode,
  run: (t: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result: T;
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error("Transaction aborted"));
        Promise.resolve(run(t)).then(
          (r) => {
            result = r;
          },
          (err) => {
            reject(err);
            try {
              t.abort();
            } catch {
              /* already settled */
            }
          },
        );
      }),
  );
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* -------------------------------------------------------------------------- */
/* chats                                                                      */
/* -------------------------------------------------------------------------- */

export function getAllChats(): Promise<ChatMeta[]> {
  return tx(STORE_CHATS, "readonly", (t) =>
    wrap(t.objectStore(STORE_CHATS).getAll() as IDBRequest<ChatMeta[]>),
  );
}

export function getChat(id: string): Promise<ChatMeta | undefined> {
  return tx(STORE_CHATS, "readonly", (t) =>
    wrap(t.objectStore(STORE_CHATS).get(id) as IDBRequest<ChatMeta | undefined>),
  );
}

export function getBody(id: string): Promise<ChatBody | undefined> {
  return tx(STORE_BODIES, "readonly", (t) =>
    wrap(t.objectStore(STORE_BODIES).get(id) as IDBRequest<ChatBody | undefined>),
  );
}

export function getAllBodies(): Promise<ChatBody[]> {
  return tx(STORE_BODIES, "readonly", (t) =>
    wrap(t.objectStore(STORE_BODIES).getAll() as IDBRequest<ChatBody[]>),
  );
}

export function putChat(meta: ChatMeta, body?: ChatBody): Promise<void> {
  const stores = body ? [STORE_CHATS, STORE_BODIES] : [STORE_CHATS];
  return tx(stores, "readwrite", async (t) => {
    await wrap(t.objectStore(STORE_CHATS).put(meta));
    if (body) await wrap(t.objectStore(STORE_BODIES).put(body));
  });
}

export function putChats(metas: ChatMeta[], bodies: ChatBody[]): Promise<void> {
  return tx([STORE_CHATS, STORE_BODIES], "readwrite", async (t) => {
    const c = t.objectStore(STORE_CHATS);
    const b = t.objectStore(STORE_BODIES);
    for (const m of metas) await wrap(c.put(m));
    for (const body of bodies) await wrap(b.put(body));
  });
}

export function deleteChat(id: string): Promise<void> {
  return tx([STORE_CHATS, STORE_BODIES], "readwrite", async (t) => {
    await wrap(t.objectStore(STORE_CHATS).delete(id));
    await wrap(t.objectStore(STORE_BODIES).delete(id));
  });
}

export function deleteChats(ids: string[]): Promise<void> {
  return tx([STORE_CHATS, STORE_BODIES], "readwrite", async (t) => {
    const c = t.objectStore(STORE_CHATS);
    const b = t.objectStore(STORE_BODIES);
    for (const id of ids) {
      await wrap(c.delete(id));
      await wrap(b.delete(id));
    }
  });
}

/* -------------------------------------------------------------------------- */
/* assets                                                                     */
/* -------------------------------------------------------------------------- */

export function getAsset(id: string): Promise<StoredAsset | undefined> {
  return tx(STORE_ASSETS, "readonly", (t) =>
    wrap(t.objectStore(STORE_ASSETS).get(id) as IDBRequest<StoredAsset | undefined>),
  );
}

export function hasAsset(id: string): Promise<boolean> {
  return tx(STORE_ASSETS, "readonly", (t) =>
    wrap(t.objectStore(STORE_ASSETS).count(id)).then((n) => n > 0),
  );
}

export function putAsset(asset: StoredAsset): Promise<void> {
  return tx(STORE_ASSETS, "readwrite", (t) =>
    wrap(t.objectStore(STORE_ASSETS).put(asset)).then(() => undefined),
  );
}

/** Ids and sizes only — reading every blob just to total them would be wasteful. */
export function assetSizes(): Promise<{ id: string; bytes: number }[]> {
  return tx(STORE_ASSETS, "readonly", (t) =>
    wrap(t.objectStore(STORE_ASSETS).getAll() as IDBRequest<StoredAsset[]>).then((all) =>
      all.map((a) => ({ id: a.id, bytes: a.bytes })),
    ),
  );
}

/**
 * Drops blobs no remaining chat points at. Called after deletions so media does
 * not quietly fill the device.
 */
export function pruneAssets(): Promise<number> {
  return tx([STORE_CHATS, STORE_ASSETS], "readwrite", async (t) => {
    const chats = await wrap(t.objectStore(STORE_CHATS).getAll() as IDBRequest<ChatMeta[]>);
    const referenced = new Set<string>();
    for (const chat of chats) {
      for (const id of chat.assetIds ?? []) referenced.add(id);
    }

    const store = t.objectStore(STORE_ASSETS);
    const ids = await wrap(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    let removed = 0;
    for (const key of ids) {
      if (!referenced.has(String(key))) {
        await wrap(store.delete(key));
        removed++;
      }
    }
    return removed;
  });
}

export function clearAssets(): Promise<void> {
  return tx(STORE_ASSETS, "readwrite", (t) =>
    wrap(t.objectStore(STORE_ASSETS).clear()).then(() => undefined),
  );
}

/* -------------------------------------------------------------------------- */
/* collections                                                                */
/* -------------------------------------------------------------------------- */

export function getCollections(): Promise<Collection[]> {
  return tx(STORE_COLLECTIONS, "readonly", (t) =>
    wrap(t.objectStore(STORE_COLLECTIONS).getAll() as IDBRequest<Collection[]>),
  );
}

export function putCollection(c: Collection): Promise<void> {
  return tx(STORE_COLLECTIONS, "readwrite", (t) =>
    wrap(t.objectStore(STORE_COLLECTIONS).put(c)).then(() => undefined),
  );
}

export function putCollections(list: Collection[]): Promise<void> {
  return tx(STORE_COLLECTIONS, "readwrite", async (t) => {
    const s = t.objectStore(STORE_COLLECTIONS);
    for (const c of list) await wrap(s.put(c));
  });
}

/** Removes the collection and detaches every chat that pointed at it. */
export function deleteCollection(id: string): Promise<void> {
  return tx([STORE_COLLECTIONS, STORE_CHATS], "readwrite", async (t) => {
    await wrap(t.objectStore(STORE_COLLECTIONS).delete(id));
    const chats = t.objectStore(STORE_CHATS);
    const all = await wrap(chats.getAll() as IDBRequest<ChatMeta[]>);
    for (const chat of all) {
      if (chat.collectionId === id) {
        await wrap(chats.put({ ...chat, collectionId: null, updatedAt: Date.now() }));
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/* key/value settings                                                         */
/* -------------------------------------------------------------------------- */

export function kvGet<T>(key: string): Promise<T | undefined> {
  return tx(STORE_KV, "readonly", (t) => wrap(t.objectStore(STORE_KV).get(key) as IDBRequest<T>));
}

export function kvSet<T>(key: string, value: T): Promise<void> {
  return tx(STORE_KV, "readwrite", (t) =>
    wrap(t.objectStore(STORE_KV).put(value, key)).then(() => undefined),
  );
}

export function clearAll(): Promise<void> {
  return tx(
    [STORE_CHATS, STORE_BODIES, STORE_COLLECTIONS, STORE_ASSETS],
    "readwrite",
    async (t) => {
      await wrap(t.objectStore(STORE_CHATS).clear());
      await wrap(t.objectStore(STORE_BODIES).clear());
      await wrap(t.objectStore(STORE_COLLECTIONS).clear());
      await wrap(t.objectStore(STORE_ASSETS).clear());
    },
  );
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

/** Asks the browser to keep the data out of the eviction pool. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}
