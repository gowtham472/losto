"use client";

import { Download, ExternalLink, ImageOff, Play, Upload, X, ZoomIn } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { assetObjectUrl } from "@/lib/assets";
import { parseAssetRef } from "@/lib/media";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AssetContextValue {
  map: Map<string, Asset>;
  /**
   * Bumped when more media finishes downloading. Anything already showing the
   * remote copy re-checks the store and switches to the offline one.
   */
  version: number;
  /** Lets the reader supply a picture the source refused to hand over. */
  onAttach?: (asset: Asset, file: File) => Promise<void>;
}

const AssetContext = createContext<AssetContextValue>({ map: new Map(), version: 0 });

export function AssetProvider({
  assets,
  version = 0,
  onAttach,
  children,
}: {
  assets: Asset[] | undefined;
  version?: number;
  onAttach?: (asset: Asset, file: File) => Promise<void>;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ map: new Map((assets ?? []).map((a) => [a.id, a])), version, onAttach }),
    [assets, version, onAttach],
  );
  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAsset(id: string | null): Asset | undefined {
  const { map } = useContext(AssetContext);
  return id ? map.get(id) : undefined;
}

/** Loads the stored blob for an asset and hands back a blob URL. */
function useAssetUrl(asset: Asset): { url: string | null; loading: boolean } {
  const { version } = useContext(AssetContext);
  const [state, setState] = useState<{ url: string | null; loading: boolean }>({
    url: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    assetObjectUrl(asset.id)
      .then((found) => {
        if (cancelled) return;
        // Nothing stored locally - fall back to the original link, which works
        // while there is a connection and the signature has not expired.
        setState({
          url: found ?? (asset.unavailable ? null : (asset.fetchUrl ?? asset.url)),
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [asset, version]);

  return state;
}

/* -------------------------------------------------------------------------- */
/* Entry point used by the markdown renderer                                  */
/* -------------------------------------------------------------------------- */

export function MediaNode({ src, alt }: { src?: string; alt?: string }) {
  const id = parseAssetRef(src);
  const asset = useAsset(id);

  // A picture that never went through the media pass - render it plainly.
  if (!id) {
    if (!src) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote/blob URLs cannot go through next/image
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        className="my-1 max-w-full rounded-card shadow-hairline"
      />
    );
  }
  if (!asset) return <MissingMedia label={alt || "Media"} />;

  switch (asset.kind) {
    case "video":
      return <VideoBlock asset={asset} />;
    case "audio":
      return <AudioBlock asset={asset} />;
    case "embed":
      return <EmbedBlock asset={asset} />;
    default:
      return <ImageBlock asset={asset} alt={alt} />;
  }
}

/* -------------------------------------------------------------------------- */
/* Images                                                                     */
/* -------------------------------------------------------------------------- */

function ImageBlock({ asset, alt }: { asset: Asset; alt?: string }) {
  const { url, loading } = useAssetUrl(asset);
  const [zoom, setZoom] = useState(false);
  const [broken, setBroken] = useState(false);
  const caption = asset.prompt ?? alt ?? asset.alt ?? "";
  const ratio = asset.width && asset.height ? asset.width / asset.height : undefined;

  if (loading) {
    return (
      <span
        className="shimmer my-1 block w-full rounded-card"
        style={{ aspectRatio: ratio ?? 16 / 10 }}
      />
    );
  }
  if (!url || broken) {
    return <MissingMedia label={caption || "Image"} asset={asset} />;
  }

  return (
    <>
      <figure className="my-1.5">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block w-full overflow-hidden rounded-card bg-inset shadow-hairline"
          aria-label={caption ? `Enlarge: ${caption}` : "Enlarge image"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image */}
          <img
            src={url}
            alt={caption}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="block max-h-[70vh] w-full object-contain"
          />
          <span className="pointer-events-none absolute right-2 top-2 flex size-7 items-center justify-center rounded-chip bg-surface/85 text-ink-2 opacity-0 shadow-btn backdrop-blur transition-opacity group-hover:opacity-100">
            <ZoomIn size={13} strokeWidth={2.2} />
          </span>
        </button>
        {caption ? (
          <figcaption className="mt-1.5 px-0.5 text-[11.5px] leading-snug text-ink-3">
            {caption}
          </figcaption>
        ) : null}
      </figure>

      {zoom ? <Lightbox url={url} caption={caption} onClose={() => setZoom(false)} /> : null}
    </>
  );
}

function Lightbox({
  url,
  caption,
  onClose,
}: {
  url: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="animate-fade-in fixed inset-0 z-[95] flex flex-col bg-[oklch(0%_0_0_/_0.88)]">
      <div className="flex items-center justify-end gap-1.5 p-2 safe-top">
        <a
          href={url}
          download
          className="flex size-9 items-center justify-center rounded-control text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Save image"
        >
          <Download size={16} strokeWidth={2.2} />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 items-center justify-center rounded-control text-white/80 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={17} strokeWidth={2.2} />
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3"
        aria-label="Close image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image */}
        <img
          src={url}
          alt={caption ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      </button>

      {caption ? (
        <p className="mx-auto max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),12px)] text-center text-[12px] leading-relaxed text-white/70">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Video, audio and players                                                   */
/* -------------------------------------------------------------------------- */

function VideoBlock({ asset }: { asset: Asset }) {
  const { url, loading } = useAssetUrl(asset);
  const label = asset.title ?? asset.alt ?? "";

  if (loading) return <span className="shimmer my-1 block aspect-video w-full rounded-card" />;
  if (!url) return <MissingMedia label={label || "Video"} asset={asset} kind="video" />;

  return (
    <figure className="my-1.5">
      <video
        controls
        preload="metadata"
        playsInline
        src={url}
        className="block w-full rounded-card bg-black shadow-hairline"
      >
        <track kind="captions" />
      </video>
      {label ? (
        <figcaption className="mt-1.5 px-0.5 text-[11.5px] text-ink-3">{label}</figcaption>
      ) : null}
    </figure>
  );
}

function AudioBlock({ asset }: { asset: Asset }) {
  const { url, loading } = useAssetUrl(asset);
  if (loading) return <span className="shimmer my-1 block h-11 w-full rounded-card" />;
  if (!url) return <MissingMedia label={asset.alt || "Audio"} asset={asset} kind="audio" />;

  return (
    <figure className="my-1.5 rounded-card bg-inset p-2 shadow-hairline">
      <audio controls src={url} className="w-full">
        <track kind="captions" />
      </audio>
    </figure>
  );
}

/**
 * A player we cannot store - the poster frame is kept offline and the button
 * opens the original, which is honest about needing a connection.
 */
function EmbedBlock({ asset }: { asset: Asset }) {
  const { url } = useAssetUrl(asset);
  const label = asset.title || asset.alt || `Watch on ${asset.provider ?? "the web"}`;

  return (
    <figure className="my-1.5">
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer noopener"
        className="group relative block overflow-hidden rounded-card bg-inset shadow-hairline"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
          <img
            src={url}
            alt={label}
            loading="lazy"
            className="block aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="stripes flex aspect-video w-full items-center justify-center" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-[oklch(0%_0_0_/_0.28)]">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface/90 text-ink shadow-raised backdrop-blur">
            <Play size={18} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
          </span>
        </span>
      </a>
      <figcaption className="mt-1.5 flex items-center gap-1.5 px-0.5 text-[11.5px] text-ink-3">
        <ExternalLink size={11} strokeWidth={2.2} />
        <span className="truncate">
          {label}
          {asset.provider ? ` · ${asset.provider}` : ""} · needs a connection
        </span>
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */

function MissingMedia({
  label,
  asset,
  kind = "image",
}: {
  label: string;
  asset?: Asset;
  kind?: string;
}) {
  const { onAttach } = useContext(AssetContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const attach = async (file: File | undefined) => {
    if (!file || !asset || !onAttach) return;
    setBusy(true);
    setProblem(null);
    try {
      await onAttach(asset, file);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That file could not be added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="stripes my-1.5 flex flex-col items-center justify-center gap-1.5 rounded-card px-4 py-6 text-center">
      <ImageOff size={16} strokeWidth={2} className="text-ink-3" />
      <span className="text-[11.5px] font-medium text-ink-2">
        {label || `This ${kind} is not stored on this device`}
      </span>
      <span className="max-w-[42ch] text-[11px] leading-snug text-ink-3">
        {asset?.unavailableReason ??
          (asset?.unavailable
            ? "The source only serves this file to a signed-in session."
            : "It was not downloaded - try Re-download media from the chat menu while online.")}
      </span>

      <span className="mt-1 flex flex-wrap items-center justify-center gap-2">
        {asset && onAttach ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(event) => {
                void attach(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-7 items-center gap-1.5 rounded-control bg-surface px-2.5 text-[11.5px] font-semibold text-ink shadow-btn transition-colors hover:bg-hover disabled:opacity-50"
            >
              <Upload size={11} strokeWidth={2.4} />
              {busy ? "Adding…" : "Add from device"}
            </button>
          </>
        ) : null}
        {asset && !asset.unavailable ? (
          <a
            href={asset.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] font-semibold text-accent-ink hover:underline"
          >
            Open the original
          </a>
        ) : null}
      </span>

      {problem ? <span className="text-[11px] text-red">{problem}</span> : null}
    </span>
  );
}

/** Small square preview used on library cards. */
export function AssetThumb({ id, className }: { id: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    assetObjectUrl(id).then((found) => {
      if (!cancelled) setUrl(found);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(load, [load]);

  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
    <img
      src={url}
      alt=""
      loading="lazy"
      className={cn("size-full object-cover", className)}
    />
  );
}
