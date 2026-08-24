"use client";

import * as db from "./db";
import type { Asset, Settings } from "./types";

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  /** What is being fetched right now, for the import screen. */
  current?: string;
}

export interface DownloadOutcome {
  stored: string[];
  /** Assets we could not copy locally - they still render if the link works. */
  skipped: { id: string; reason: "unavailable" | "too-large" | "failed" | "policy" }[];
  bytes: number;
}

/** Data URLs come straight from the payload; everything else needs the proxy. */
function fetchUrlFor(asset: Asset): string | null {
  const target = asset.fetchUrl ?? (asset.kind === "embed" ? undefined : asset.url);
  if (!target) return null;
  if (target.startsWith("data:")) return target;
  if (!/^https?:\/\//i.test(target)) return null;
  return `/api/asset?url=${encodeURIComponent(target)}`;
}

function wanted(asset: Asset, media: Settings["media"]): boolean {
  if (media === "none") return false;
  if (media === "images") return asset.kind === "image" || asset.kind === "embed";
  return true;
}

/**
 * Copies each asset onto the device. Runs a few at a time so a chat with twenty
 * pictures does not stall on one slow file, and reuses anything already stored.
 */
export async function downloadAssets(
  assets: Asset[],
  settings: Pick<Settings, "media" | "maxAssetMB">,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<DownloadOutcome> {
  const outcome: DownloadOutcome = { stored: [], skipped: [], bytes: 0 };
  if (!assets.length) return outcome;

  const maxBytes = Math.max(1, settings.maxAssetMB) * 1024 * 1024;
  const queue = [...assets];
  let done = 0;

  const report = (current?: string) =>
    onProgress?.({ done, total: assets.length, bytes: outcome.bytes, current });

  report();

  const worker = async () => {
    while (queue.length) {
      if (signal?.aborted) return;
      const asset = queue.shift();
      if (!asset) return;

      try {
        if (asset.unavailable) {
          outcome.skipped.push({ id: asset.id, reason: "unavailable" });
        } else if (!wanted(asset, settings.media)) {
          outcome.skipped.push({ id: asset.id, reason: "policy" });
        } else if (await db.hasAsset(asset.id)) {
          outcome.stored.push(asset.id);
        } else {
          const stored = await storeOne(asset, maxBytes, signal);
          if (stored === "too-large") {
            outcome.skipped.push({ id: asset.id, reason: "too-large" });
          } else if (stored === null) {
            outcome.skipped.push({ id: asset.id, reason: "failed" });
          } else {
            outcome.stored.push(asset.id);
            outcome.bytes += stored;
          }
        }
      } catch {
        outcome.skipped.push({ id: asset.id, reason: "failed" });
      }

      done++;
      report(asset.alt || asset.title || asset.url);
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, assets.length) }, worker));
  report();
  return outcome;
}

const RETRY_STATUSES = new Set([429, 503]);

async function storeOne(
  asset: Asset,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<number | null | "too-large"> {
  const href = fetchUrlFor(asset);
  if (!href) return null;

  let response = await fetch(href, { signal, cache: "no-store" });

  // Image hosts rate-limit a burst of downloads; one polite retry usually wins.
  if (RETRY_STATUSES.has(response.status)) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 5) * 1000 : 1500;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (signal?.aborted) return null;
    response = await fetch(href, { signal, cache: "no-store" });
  }

  if (!response.ok) return null;

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared && declared > maxBytes) return "too-large";

  const blob = await response.blob();
  if (blob.size > maxBytes) return "too-large";
  if (!blob.size) return null;

  await db.putAsset({
    id: asset.id,
    blob,
    mime: blob.type || asset.mime || "application/octet-stream",
    bytes: blob.size,
    savedAt: Date.now(),
  });
  return blob.size;
}

/* -------------------------------------------------------------------------- */
/* Object URLs                                                                */
/* -------------------------------------------------------------------------- */

const objectUrls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/**
 * Hands back a blob URL for a stored asset, creating it once and keeping it for
 * the life of the tab so scrolling back to an image does not re-read the store.
 */
export function assetObjectUrl(id: string): Promise<string | null> {
  const existing = objectUrls.get(id);
  if (existing) return Promise.resolve(existing);

  const inFlight = pending.get(id);
  if (inFlight) return inFlight;

  const task = db
    .getAsset(id)
    .then((stored) => {
      if (!stored?.blob) return null;
      const url = URL.createObjectURL(stored.blob);
      objectUrls.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => pending.delete(id));

  pending.set(id, task);
  return task;
}

export function releaseObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

/** Forgets a cached blob URL so the next read picks up replaced bytes. */
export function invalidateAsset(id: string) {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
  pending.delete(id);
}

export class AttachError extends Error {}

/**
 * Stores a file the reader picked themselves under an existing asset id.
 *
 * This is how a picture the source will not hand over gets into the library:
 * the markdown already points at the id, so writing bytes there makes the
 * placeholder become the real image with nothing else to change.
 */
export async function storeLocalAsset(
  id: string,
  file: File,
  maxAssetMB: number,
): Promise<{ id: string; bytes: number; mime: string }> {
  if (!/^(image|video|audio)\//.test(file.type)) {
    throw new AttachError("That file is not a picture, video or audio clip.");
  }
  const limit = Math.max(1, maxAssetMB) * 1024 * 1024;
  if (file.size > limit) {
    throw new AttachError(`That file is larger than the ${maxAssetMB} MB limit set in Settings.`);
  }
  if (!file.size) throw new AttachError("That file is empty.");

  await db.putAsset({
    id,
    blob: file,
    mime: file.type,
    bytes: file.size,
    savedAt: Date.now(),
  });
  invalidateAsset(id);
  return { id, bytes: file.size, mime: file.type };
}
