/**
 * A shareable copy of one or more chats.
 *
 * Losto has no server, so there is nothing for two devices to meet on. What
 * they can both reach is the phone's own radio - AirDrop, Quick Share,
 * Bluetooth - and a camera pointed at a screen. Both of those move *files* and
 * *bytes*, not connections, which is what this format is for: one self-contained
 * blob that carries a conversation, its pictures and its credit line, and can be
 * handed over by whatever means happens to work.
 *
 * The bytes are gzipped JSON. Media travels inside as base64, because a chat
 * whose diagrams arrive as broken links is no use to someone with no signal -
 * which is the entire point of passing it across.
 */
import { getAsset, putAsset } from "./db";
import type { ChatMessage, ChatMeta, Collection } from "./types";

export const BUNDLE_EXTENSION = ".losto";
export const BUNDLE_MIME = "application/octet-stream";

/** Bumped only for a change old readers could not survive. */
const BUNDLE_VERSION = 1;

export interface BundleAsset {
  id: string;
  mime: string;
  /** Standard base64, no data: prefix. */
  data: string;
}

export interface Bundle {
  app: "losto-share";
  version: number;
  exportedAt: number;
  chats: (ChatMeta & { messages: ChatMessage[] })[];
  collections: Collection[];
  assets: BundleAsset[];
}

/* -------------------------------------------------------------------------- */
/* the code                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Seven digits derived from the bytes themselves.
 *
 * It is deliberately not an address. Nothing can look a device up by it, because
 * a page in a browser cannot listen for anything - every product that pairs by
 * code has a server doing the introductions. What it can honestly do is prove
 * both sides are holding the same bundle: the sender reads their code out, the
 * receiver checks it against the one Losto shows after reading the file.
 */
export async function bundleCode(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view.buffer as ArrayBuffer);
  const head = new DataView(digest).getUint32(0, false);
  return String(head % 10_000_000).padStart(7, "0");
}

/** `4820 193` - easier to read aloud than seven digits in a row. */
export function formatCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/* -------------------------------------------------------------------------- */
/* building                                                                   */
/* -------------------------------------------------------------------------- */

export interface BundleInput {
  chats: (ChatMeta & { messages: ChatMessage[] })[];
  collections: Collection[];
  /** Leave media out for a text-only bundle small enough to go by QR. */
  withMedia: boolean;
  /** Skip anything larger than this, so one photo cannot sink the transfer. */
  maxAssetBytes?: number;
}

export async function buildBundle(input: BundleInput): Promise<Bundle> {
  const assets: BundleAsset[] = [];

  if (input.withMedia) {
    const wanted = new Set<string>();
    for (const chat of input.chats) {
      for (const id of chat.assetIds ?? []) wanted.add(id);
    }
    for (const id of wanted) {
      const stored = await getAsset(id);
      if (!stored) continue;
      if (input.maxAssetBytes && stored.bytes > input.maxAssetBytes) continue;
      assets.push({
        id,
        mime: stored.mime,
        data: await blobToBase64(stored.blob),
      });
    }
  }

  return {
    app: "losto-share",
    version: BUNDLE_VERSION,
    exportedAt: Date.now(),
    chats: input.chats,
    collections: input.collections,
    assets,
  };
}

/** Writes a bundle's media into local storage, ready for the reader to open. */
export async function storeBundleAssets(bundle: Bundle): Promise<number> {
  let stored = 0;
  for (const asset of bundle.assets ?? []) {
    const blob = base64ToBlob(asset.data, asset.mime);
    if (!blob) continue;
    await putAsset({
      id: asset.id,
      blob,
      mime: asset.mime,
      bytes: blob.size,
      savedAt: Date.now(),
    });
    stored += 1;
  }
  return stored;
}

/* -------------------------------------------------------------------------- */
/* packing                                                                    */
/* -------------------------------------------------------------------------- */

export async function packBundle(bundle: Bundle): Promise<Uint8Array> {
  return gzip(new TextEncoder().encode(JSON.stringify(bundle)));
}

export async function unpackBundle(bytes: Uint8Array): Promise<Bundle> {
  // A gzip stream always opens 1f 8b. Anything else is either a plain JSON
  // export or not ours at all, and both are worth trying to read.
  const raw =
    bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : bytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("That file is not something Losto can read.");
  }
  return asBundle(parsed);
}

/**
 * Accepts a share bundle, and also a plain library backup, so a friend can send
 * either one and the receiving end does not have to care which.
 */
export function asBundle(value: unknown): Bundle {
  const raw = value as Partial<Bundle> & { app?: string };
  if (raw?.app !== "losto-share" && raw?.app !== "losto") {
    throw new Error("That file did not come from Losto.");
  }
  if (!Array.isArray(raw.chats)) {
    throw new Error("That bundle has no chats in it.");
  }
  if (typeof raw.version === "number" && raw.version > BUNDLE_VERSION) {
    throw new Error("That bundle was made by a newer version of Losto.");
  }
  return {
    app: "losto-share",
    version: raw.version ?? BUNDLE_VERSION,
    exportedAt: raw.exportedAt ?? Date.now(),
    chats: raw.chats,
    collections: raw.collections ?? [],
    assets: raw.assets ?? [],
  };
}

/** A filename a person can recognise in a downloads folder a week later. */
export function bundleFilename(bundle: Bundle, code: string): string {
  const one = bundle.chats.length === 1 ? bundle.chats[0].title : null;
  const stem = one
    ? one
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "chat"
    : `${bundle.chats.length}-chats`;
  return `losto-${stem}-${code}${BUNDLE_EXTENSION}`;
}

/* -------------------------------------------------------------------------- */
/* plumbing                                                                   */
/* -------------------------------------------------------------------------- */

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") return bytes;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot read compressed bundles.");
  }
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mime: string): Blob | null {
  try {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || "application/octet-stream" });
  } catch {
    return null;
  }
}
