"use client";

import { Check, Download, QrCode, Send, Loader2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BUNDLE_MIME,
  type Bundle,
  bundleCode,
  bundleFilename,
  formatCode,
  packBundle,
} from "@/lib/bundle";
import { FRAME_MS, QR_MAX_BYTES, type QrFrame, toFrames } from "@/lib/qr";
import { useLibrary } from "@/lib/store";
import type { ChatMeta } from "@/lib/types";
import { formatBytes } from "@/lib/utils";
import { Button, Segmented, Spinner, Well } from "./ui/primitives";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";

type Mode = "file" | "qr";

interface Packed {
  bytes: Uint8Array;
  code: string;
  bundle: Bundle;
  frames?: QrFrame[];
  tooBig?: boolean;
}

export function ShareSheet({
  chat,
  open,
  onClose,
}: {
  chat: ChatMeta | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !chat) return null;
  return <ShareSheetInner key={chat.id} chat={chat} onClose={onClose} />;
}

function ShareSheetInner({ chat, onClose }: { chat: ChatMeta; onClose: () => void }) {
  const { exportChats } = useLibrary();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("file");
  const [packed, setPacked] = useState<Partial<Record<Mode, Packed>>>({});

  /*
   * Both bundles are built up front rather than on the tap. Safari only lets
   * navigator.share run inside a gesture, and anything awaited first spends
   * that permission - so by the time the button is pressed the file exists.
   */
  const build = useCallback(
    async (which: Mode) => {
      const bundle = await exportChats([chat.id], { media: which === "file" });
      const bytes = await packBundle(bundle);
      const code = await bundleCode(bytes);
      const tooBig = which === "qr" && bytes.length > QR_MAX_BYTES;
      return {
        bundle,
        bytes,
        code,
        tooBig,
        frames: which === "qr" && !tooBig ? toFrames(bytes) : undefined,
      };
    },
    [chat.id, exportChats],
  );

  // Each mode is packed once and kept, so flipping between them is instant.
  useEffect(() => {
    if (packed[mode]) return;
    let cancelled = false;
    build(mode)
      .then((result) => {
        if (!cancelled) setPacked((prev) => ({ ...prev, [mode]: result }));
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not prepare that chat for sending");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, packed, build, toast]);

  const current = packed[mode];

  return (
    <Sheet
      open
      onClose={onClose}
      title="Send to a friend"
      description="Works with no internet. Nothing passes through a server."
      size={mode === "qr" ? "lg" : "md"}
    >
      <div className="space-y-4">
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as Mode)}
          options={[
            { value: "file", label: "Send a file" },
            { value: "qr", label: "Show a code" },
          ]}
        />

        {!current ? (
          <div className="flex flex-col items-center gap-2 py-12 text-ink-3">
            <Spinner />
            <p className="text-[12px]">Packing the chat…</p>
          </div>
        ) : mode === "file" ? (
          <FileMode chat={chat} packed={current} onDone={onClose} />
        ) : (
          <QrMode packed={current} onSwitch={() => setMode("file")} />
        )}
      </div>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* file                                                                       */
/* -------------------------------------------------------------------------- */

function FileMode({
  chat,
  packed,
  onDone,
}: {
  chat: ChatMeta;
  packed: Packed;
  onDone: () => void;
}) {
  const toast = useToast();
  const [sending, setSending] = useState(false);

  const file = useMemo(
    () =>
      new File([packed.bytes as BlobPart], bundleFilename(packed.bundle, packed.code), {
        type: BUNDLE_MIME,
      }),
    [packed],
  );

  // Not every browser will hand an arbitrary file to the share sheet; saving it
  // and sending it from the files app gets there just as well.
  const shareable =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  const save = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Saved to this device", "Send it with AirDrop, Quick Share or Bluetooth.");
  };

  const mediaCount = packed.bundle.assets.length;

  return (
    <div className="space-y-4">
      <Code code={packed.code} />

      <Well className="space-y-1.5 p-3 text-[12px] leading-relaxed text-ink-2">
        <p>
          <strong className="font-semibold text-ink">{chat.title}</strong> ·{" "}
          {formatBytes(packed.bytes.length)}
          {mediaCount ? ` · ${mediaCount} media ${mediaCount === 1 ? "file" : "files"}` : ""}
        </p>
        <p>
          Pictures travel inside the file, so it opens on their device with no signal. Their copy
          keeps the source and the credit line.
        </p>
      </Well>

      <div className="flex flex-wrap gap-2">
        {shareable ? (
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              try {
                await navigator.share({ files: [file], title: chat.title });
                onDone();
              } catch (error) {
                // Dismissing the share sheet rejects, and is not a failure.
                if ((error as Error)?.name !== "AbortError") {
                  toast.error("Could not open the share sheet", "Save the file and send it instead.");
                }
              } finally {
                setSending(false);
              }
            }}
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={2.2} />}
            AirDrop, Quick Share…
          </Button>
        ) : null}
        <Button size="lg" className={shareable ? undefined : "flex-1"} onClick={save}>
          <Download size={14} strokeWidth={2.2} />
          Save the file
        </Button>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ink-3">
        On their phone: open Losto → Add a chat → Receive, and pick the file. Check the seven
        digits match before they keep it.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* qr                                                                         */
/* -------------------------------------------------------------------------- */

function QrMode({ packed, onSwitch }: { packed: Packed; onSwitch: () => void }) {
  const [index, setIndex] = useState(0);
  const frames = packed.frames;

  // The screen has no way of knowing what the camera caught, so the loop simply
  // runs until the other side says it has everything.
  useEffect(() => {
    if (!frames || frames.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % frames.length);
    }, FRAME_MS);
    return () => window.clearInterval(timer);
  }, [frames]);

  if (packed.tooBig || !frames) {
    return (
      <div className="space-y-3">
        <Well className="flex items-start gap-2.5 p-3">
          <TriangleAlert size={15} strokeWidth={2.1} className="mt-px shrink-0 text-orange" />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">Too long for the camera.</strong> This chat
            is {formatBytes(packed.bytes.length)} even with the pictures left out, which is more
            frames than anyone wants to hold a phone still for. Send it as a file instead.
          </p>
        </Well>
        <Button variant="primary" size="lg" className="w-full" onClick={onSwitch}>
          Send a file instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto w-full max-w-[320px]">
        <QrFrameView frame={frames[index]} />
      </div>

      <div className="flex items-center justify-center gap-2 font-mono text-[11px] tabnums text-ink-3">
        <QrCode size={12} strokeWidth={2.2} />
        {frames.length === 1 ? "single code" : `frame ${index + 1} of ${frames.length}`}
      </div>

      <Code code={packed.code} />

      <p className="text-[11.5px] leading-relaxed text-ink-3">
        On their phone: Add a chat → Receive → Scan. Hold both still until it fills up
        {frames.length > 1 ? " - the codes keep cycling, so a missed one comes back around" : ""}.
        Pictures are left out of a scanned copy.
      </p>
    </div>
  );
}

/** One frame, drawn as a single SVG path so it stays crisp at any size. */
export function QrFrameView({ frame }: { frame: QrFrame }) {
  const size = frame.cells.length;
  const quiet = 2;
  const path = useMemo(() => {
    let d = "";
    frame.cells.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
      });
    });
    return d;
  }, [frame]);

  return (
    <svg
      viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`}
      className="w-full rounded-card bg-white shadow-hairline"
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Transfer code, frame ${frame.seq + 1} of ${frame.total}`}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

function Code({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).catch(() => {});
        setCopied(true);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
      }}
      className="flex w-full flex-col items-center gap-1 rounded-card bg-inset py-3 shadow-hairline transition-colors hover:bg-hover"
    >
      <span className="font-mono text-[24px] font-semibold tabnums tracking-[0.12em] text-ink">
        {formatCode(code)}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-ink-3">
        {copied ? <Check size={10} strokeWidth={2.6} className="text-green" /> : null}
        {copied ? "Copied" : "Read this out - their copy shows the same number"}
      </span>
    </button>
  );
}
