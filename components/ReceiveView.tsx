"use client";

import { Camera, Check, FileDown, Loader2, QrCode, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button, Card, Segmented, Well } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { type Bundle, bundleCode, formatCode, unpackBundle } from "@/lib/bundle";
import { FrameCollector } from "@/lib/qr";
import { useLibrary } from "@/lib/store";

type Mode = "scan" | "file";

interface Received {
  bundle: Bundle;
  code: string;
}

export function ReceiveView() {
  const [mode, setMode] = useState<Mode>("scan");
  const [received, setReceived] = useState<Received | null>(null);

  return (
    <>
      <PageHeader
        sticky={false}
        title="Receive a chat"
        subtitle="From someone next to you. No internet, no account, nothing through a server."
      />

      <div className="mx-auto max-w-lg space-y-4 px-4 pb-14 lg:px-8">
        {received ? (
          <Confirmation received={received} onCancel={() => setReceived(null)} />
        ) : (
          <>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { value: "scan", label: "Scan a code" },
                { value: "file", label: "Open a file" },
              ]}
            />
            {mode === "scan" ? (
              <Scanner onBundle={setReceived} />
            ) : (
              <FilePicker onBundle={setReceived} />
            )}
          </>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* confirm before anything is written                                         */
/* -------------------------------------------------------------------------- */

function Confirmation({ received, onCancel }: { received: Received; onCancel: () => void }) {
  const { importBundle } = useLibrary();
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const titles = received.bundle.chats.map((c) => c.title);
  const media = received.bundle.assets.length;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-col items-center gap-1 rounded-card bg-inset py-3 shadow-hairline">
          <span className="font-mono text-[24px] font-semibold tabnums tracking-[0.12em] text-ink">
            {formatCode(received.code)}
          </span>
          <span className="text-[11px] text-ink-3">Check this matches the sender&apos;s screen</span>
        </div>

        <ul className="space-y-1">
          {titles.slice(0, 6).map((title, i) => (
            <li key={`${title}-${i}`} className="flex gap-2 text-[12.5px] leading-snug text-ink">
              <Check size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-green" />
              <span className="flex-1">{title}</span>
            </li>
          ))}
          {titles.length > 6 ? (
            <li className="pl-5 text-[12px] text-ink-3">and {titles.length - 6} more</li>
          ) : null}
        </ul>

        <p className="text-[11.5px] leading-relaxed text-ink-3">
          {media
            ? `${media} media ${media === 1 ? "file" : "files"} included, so it reads offline.`
            : "No pictures in this one - a scanned copy leaves media behind."}{" "}
          Each chat keeps the source it came from and its credit line.
        </p>
      </Card>

      <div className="flex gap-2">
        <Button size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const added = await importBundle(received.bundle);
              if (!added.chats) {
                toast.error("Already on this device", "Nothing new to add.");
                onCancel();
                return;
              }
              toast.success(
                `${added.chats} ${added.chats === 1 ? "chat" : "chats"} added`,
                added.media ? `${added.media} media files stored.` : undefined,
              );
              router.push("/library");
            } catch (error) {
              toast.error("Could not save it", (error as Error)?.message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Keep on this device
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* file                                                                       */
/* -------------------------------------------------------------------------- */

function FilePicker({ onBundle }: { onBundle: (r: Received) => void }) {
  const toast = useToast();

  return (
    <Card className="space-y-3 p-4">
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        Pick the <code className="rounded bg-inset px-1 py-0.5 font-mono text-[11px]">.losto</code>{" "}
        file they sent you - by AirDrop, Quick Share, Bluetooth, or any other way it reached this
        device. A library backup works here too.
      </p>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-control bg-surface py-3 text-[13px] font-medium text-ink shadow-btn transition-colors hover:bg-hover">
        <FileDown size={14} strokeWidth={2.2} />
        Choose a file
        <input
          type="file"
          accept=".losto,.json,application/json,application/octet-stream"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const bundle = await unpackBundle(bytes);
              onBundle({ bundle, code: await bundleCode(bytes) });
            } catch (error) {
              toast.error("Could not read that file", (error as Error)?.message);
            }
          }}
        />
      </label>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* camera                                                                     */
/* -------------------------------------------------------------------------- */

type ScanState = "idle" | "starting" | "running" | "denied" | "unsupported";

function Scanner({ onBundle }: { onBundle: (r: Received) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const collector = useRef(new FrameCollector());
  const [state, setState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState({ got: 0, total: 0 });
  const toast = useToast();

  const finish = useCallback(
    async (bytes: Uint8Array) => {
      try {
        const bundle = await unpackBundle(bytes);
        onBundle({ bundle, code: await bundleCode(bytes) });
      } catch (error) {
        toast.error("That transfer did not come through cleanly", (error as Error)?.message);
        collector.current.reset();
        setProgress({ got: 0, total: 0 });
      }
    },
    [onBundle, toast],
  );

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setState("running");
    } catch {
      setState("denied");
    }
  }, []);

  // Stop the camera the moment this leaves the screen - a light left on behind
  // a navigation is the kind of thing that makes people uninstall an app.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (state !== "running") return;
    let stopped = false;
    let raf = 0;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    // Chrome decodes in the platform, which is far faster than doing it in JS.
    // Everywhere else falls back to the bundled decoder.
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o: { formats: string[] }) => {
          detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    const read = async () => {
      const video = videoRef.current;
      if (stopped || !video || video.readyState < 2 || !context) {
        raf = requestAnimationFrame(read);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      let value: string | null = null;
      if (detector) {
        const found = await detector.detect(canvas).catch(() => []);
        value = found[0]?.rawValue ?? null;
      } else {
        const { default: jsQR } = await import("jsqr");
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        value = jsQR(image.data, image.width, image.height)?.data ?? null;
      }

      if (value && collector.current.accept(value)) {
        setProgress({ got: collector.current.received, total: collector.current.expected });
        if (collector.current.complete) {
          stopped = true;
          const bytes = collector.current.assemble();
          collector.current.reset();
          void finish(bytes);
          return;
        }
      }

      if (!stopped) raf = requestAnimationFrame(read);
    };

    raf = requestAnimationFrame(read);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [state, finish]);

  const percent = progress.total ? Math.round((progress.got / progress.total) * 100) : 0;

  return (
    <Card className="space-y-3 p-4">
      <div className="relative aspect-square overflow-hidden rounded-card bg-inset">
        <video
          ref={videoRef}
          playsInline
          muted
          className="size-full object-cover"
          style={{ display: state === "running" ? undefined : "none" }}
        />

        {state !== "running" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <QrCode size={26} strokeWidth={1.8} className="text-ink-3" />
            {state === "denied" ? (
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Losto cannot see the camera. Allow camera access for this site, then try again.
              </p>
            ) : state === "unsupported" ? (
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                This browser will not open the camera. Ask them to send the file instead.
              </p>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Point this at the code on their screen. The picture never leaves this device.
              </p>
            )}
            <Button variant="primary" onClick={start} disabled={state === "starting"}>
              {state === "starting" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Camera size={14} strokeWidth={2.2} />
              )}
              {state === "denied" ? "Try again" : "Start the camera"}
            </Button>
          </div>
        ) : null}
      </div>

      {state === "running" ? (
        progress.total ? (
          <div className="space-y-1.5">
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-green transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-center font-mono text-[11px] tabnums text-ink-2">
              {progress.got} of {progress.total} pieces
            </p>
          </div>
        ) : (
          <p className="text-center text-[12px] text-ink-3">Looking for a code…</p>
        )
      ) : null}

      <Well className="flex items-start gap-2.5 p-3">
        <TriangleAlert size={14} strokeWidth={2.1} className="mt-px shrink-0 text-ink-3" />
        <p className="text-[11.5px] leading-relaxed text-ink-2">
          A scanned copy carries the words, not the pictures. For a chat with diagrams in it, ask
          them to send the file.
        </p>
      </Well>
    </Card>
  );
}
