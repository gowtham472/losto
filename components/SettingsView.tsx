"use client";

import {
  Download,
  HardDrive,
  Minus,
  Moon,
  Plus,
  Scale,
  Share,
  Smartphone,
  Sun,
  SunMoon,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { Button, Card, Label, SectionTitle, Segmented, Well } from "@/components/ui/primitives";
import { Confirm } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { estimateStorage, requestPersistence } from "@/lib/db";
import { useLibrary, useMediaQuery } from "@/lib/store";
import type { BackupFile } from "@/lib/types";
import { downloadFile, formatBytes } from "@/lib/utils";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function SettingsView() {
  const { chats, collections, settings, setSetting, exportBackup, importBackup, wipe } =
    useLibrary();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [wiping, setWiping] = useState(false);

  // Running from the home screen is browser state, not React state.
  const standalone = useMediaQuery("(display-mode: standalone)");
  const installed = standalone || justInstalled;

  useEffect(() => {
    estimateStorage().then(setStorage);
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const doExport = async () => {
    const backup = await exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`losto-backup-${stamp}.json`, JSON.stringify(backup));
    toast.success("Backup downloaded", `${backup.chats.length} chats included.`);
  };

  const doImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      const { chats: added, collections: subjects } = await importBackup(parsed);
      toast.success(
        added ? `${added} chats restored` : "Nothing new to restore",
        subjects ? `${subjects} subjects added too.` : "Duplicates were skipped.",
      );
    } catch (err) {
      toast.error(
        "Could not read that file",
        err instanceof Error ? err.message : "Pick a Losto backup file.",
      );
    }
  };

  // Site icons are stored alongside media but are not what a reader means by it.
  const mediaFiles = chats.reduce(
    (sum, c) => sum + (c.assetIds ?? []).filter((id) => id !== c.faviconAssetId).length,
    0,
  );
  const mediaBytes = chats.reduce((sum, c) => sum + (c.mediaBytes ?? 0), 0);

  const usedPercent =
    storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <>
      <PageHeader title="Settings" subtitle="Everything here stays on this device." />

      <div className="mx-auto max-w-3xl space-y-6 px-4 pb-10 lg:px-8">
        {/* appearance */}
        <section>
          <SectionTitle index="01">Appearance</SectionTitle>
          <Card className="divide-y divide-line">
            <Row label="Theme">
              <Segmented
                value={settings.theme}
                onChange={(v) => setSetting("theme", v)}
                options={[
                  { value: "light", label: <Sun size={13} strokeWidth={2.2} />, title: "Light" },
                  { value: "system", label: <SunMoon size={13} strokeWidth={2.2} />, title: "System" },
                  { value: "dark", label: <Moon size={13} strokeWidth={2.2} />, title: "Dark" },
                ]}
              />
            </Row>
            <Row label="Library layout">
              <Segmented
                value={settings.view}
                onChange={(v) => setSetting("view", v)}
                options={[
                  { value: "grid", label: "Cards" },
                  { value: "list", label: "List" },
                ]}
              />
            </Row>
          </Card>
        </section>

        {/* reading */}
        <section>
          <SectionTitle index="02">Reading</SectionTitle>
          <Card className="divide-y divide-line">
            <Row label="Text size" hint={`${settings.readerSize}px`}>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon-sm"
                  aria-label="Smaller"
                  onClick={() => setSetting("readerSize", Math.max(13, settings.readerSize - 1))}
                >
                  <span className="text-[11px] font-semibold">A</span>
                </Button>
                <Button
                  size="icon-sm"
                  aria-label="Larger"
                  onClick={() => setSetting("readerSize", Math.min(22, settings.readerSize + 1))}
                >
                  <span className="text-[14px] font-semibold">A</span>
                </Button>
              </div>
            </Row>
            <Row label="Typeface">
              <Segmented
                value={settings.readerTypeface}
                onChange={(v) => setSetting("readerTypeface", v)}
                options={[
                  { value: "sans", label: "Sans" },
                  { value: "serif", label: "Serif" },
                  { value: "mono", label: "Mono" },
                ]}
              />
            </Row>
            <Row label="Layout" hint="Chat keeps the bubbles; document reads like notes.">
              <Segmented
                value={settings.readerLayout}
                onChange={(v) => setSetting("readerLayout", v)}
                options={[
                  { value: "chat", label: "Chat" },
                  { value: "document", label: "Document" },
                ]}
              />
            </Row>
            <Row label="Reasoning traces" hint="Show the model's thinking when a chat has it.">
              <Segmented
                value={settings.showThinking ? "on" : "off"}
                onChange={(v) => setSetting("showThinking", v === "on")}
                options={[
                  { value: "off", label: "Hide" },
                  { value: "on", label: "Show" },
                ]}
              />
            </Row>
          </Card>
        </section>

        {/* media */}
        <section>
          <SectionTitle index="03">Pictures and video</SectionTitle>
          <Card className="divide-y divide-line">
            <Row
              label="Copy media for offline"
              hint="Media links from the assistants expire within hours, so the files are copied onto this device as each chat is saved."
            >
              <Segmented
                value={settings.media}
                onChange={(v) => setSetting("media", v)}
                options={[
                  { value: "all", label: "All" },
                  { value: "images", label: "Images" },
                  { value: "none", label: "Off" },
                ]}
              />
            </Row>
            <Row
              label="Skip files bigger than"
              hint="Keeps one long clip from filling the phone."
            >
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon-sm"
                  aria-label="Lower the size limit"
                  onClick={() =>
                    setSetting("maxAssetMB", Math.max(1, settings.maxAssetMB - 5))
                  }
                >
                  <Minus size={13} strokeWidth={2.4} />
                </Button>
                <span className="w-14 text-center font-mono text-[11.5px] tabnums text-ink-2">
                  {settings.maxAssetMB} MB
                </span>
                <Button
                  size="icon-sm"
                  aria-label="Raise the size limit"
                  onClick={() =>
                    setSetting("maxAssetMB", Math.min(200, settings.maxAssetMB + 5))
                  }
                >
                  <Plus size={13} strokeWidth={2.4} />
                </Button>
              </div>
            </Row>
          </Card>
        </section>

        {/* install */}
        <section>
          <SectionTitle index="04">Install on your phone</SectionTitle>
          <Card className="p-3">
            {installed ? (
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                Losto is running as an installed app. Saved chats open instantly, even in airplane
                mode.
              </p>
            ) : installEvent ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] leading-relaxed text-ink-2">
                  Add Losto to your home screen for offline access and the share-to-Losto shortcut.
                </p>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await installEvent.prompt();
                    const { outcome } = await installEvent.userChoice;
                    if (outcome === "accepted") {
                      setJustInstalled(true);
                      toast.success("Installing Losto…");
                    }
                    setInstallEvent(null);
                  }}
                >
                  <Smartphone size={14} strokeWidth={2.2} />
                  Install app
                </Button>
              </div>
            ) : (
              <div className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">
                <p className="flex items-start gap-2">
                  <Share size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-3" />
                  <span>
                    <strong className="font-semibold text-ink">iPhone:</strong> tap Share in Safari,
                    then <em>Add to Home Screen</em>.
                  </span>
                </p>
                <p className="flex items-start gap-2">
                  <Smartphone size={13} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ink-3" />
                  <span>
                    <strong className="font-semibold text-ink">Android:</strong> open the browser
                    menu and choose <em>Install app</em> or <em>Add to Home screen</em>.
                  </span>
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* storage */}
        <section>
          <SectionTitle index="05">Storage</SectionTitle>
          <Card className="divide-y divide-line">
            <div className="p-3">
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  <HardDrive size={13} strokeWidth={2.2} className="text-ink-3" />
                  On this device
                </span>
                <span className="font-mono text-[11.5px] tabnums text-ink-2">
                  {storage ? `${formatBytes(storage.usage)} of ${formatBytes(storage.quota)}` : "-"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${Math.max(1.5, usedPercent)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[10.5px] tabnums text-ink-3">
                {chats.length} chats · {collections.length} subjects ·{" "}
                {chats.reduce((sum, c) => sum + c.wordCount, 0).toLocaleString()} words ·{" "}
                {mediaFiles} media ({formatBytes(mediaBytes)})
              </p>
            </div>

            <Row
              label="Keep data safe from cleanup"
              hint={
                persisted
                  ? "Granted - the browser will not evict your library."
                  : "Ask the browser to protect Losto's storage."
              }
            >
              <Button
                disabled={persisted === true}
                onClick={async () => {
                  const granted = await requestPersistence();
                  setPersisted(granted);
                  if (granted) toast.success("Storage protected");
                  else
                    toast.error(
                      "The browser declined",
                      "Installing Losto to your home screen usually grants it.",
                    );
                }}
              >
                {persisted ? "Protected" : "Request"}
              </Button>
            </Row>
          </Card>
        </section>

        {/* backup */}
        <section>
          <SectionTitle index="06">Backup and transfer</SectionTitle>
          <Card className="divide-y divide-line">
            <Row
              label="Export everything"
              hint="One JSON file with every chat, subject and tag. Pictures and clips stay on this device - after restoring, use Re-download media on a chat to fetch them again."
            >
              <Button onClick={doExport} disabled={!chats.length}>
                <Download size={13} strokeWidth={2.2} />
                Export
              </Button>
            </Row>
            <Row label="Restore a backup" hint="Duplicates are skipped, so it is safe to re-import.">
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) doImport(file);
                    e.target.value = "";
                  }}
                />
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload size={13} strokeWidth={2.2} />
                  Restore
                </Button>
              </>
            </Row>
          </Card>
        </section>

        {/* danger */}
        <section>
          <SectionTitle index="07">Danger zone</SectionTitle>
          <Card className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-medium text-ink">Delete everything</p>
                <p className="mt-0.5 text-[11.5px] text-ink-2">
                  Wipes every saved chat and subject from this device.
                </p>
              </div>
              <Button
                className="bg-red text-white hover:opacity-90"
                onClick={() => setWiping(true)}
                disabled={!chats.length && !collections.length}
              >
                <Trash2 size={13} strokeWidth={2.2} />
                Delete all
              </Button>
            </div>
          </Card>
        </section>

        <Well className="space-y-2 p-3">
          <p className="text-[11.5px] leading-relaxed text-ink-2">
            <strong className="font-semibold text-ink">Losto keeps nothing on a server.</strong>{" "}
            Chats live in this browser&apos;s storage. The only network request Losto makes is
            fetching a link you paste, and that response goes straight to your device without being
            stored anywhere else.
          </p>
          <p className="text-[11.5px] leading-relaxed text-ink-2">
            Saved articles keep their author and original link attached, and Losto respects
            robots.txt - it will not fetch a page whose site asks automated tools to stay away.
          </p>
          <Link
            href="/legal"
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-accent-ink hover:underline"
          >
            <Scale size={12} strokeWidth={2.2} />
            Privacy, terms and open-source notices
          </Link>
        </Well>
      </div>

      <Confirm
        open={wiping}
        onClose={() => setWiping(false)}
        title="Delete everything?"
        description="Every chat, subject and tag will be erased from this device. Export a backup first if you might want them back."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          await wipe();
          toast.success("Library cleared");
        }}
      />
    </>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <Label className="normal-case tracking-normal text-[12.5px] font-medium text-ink">
          {label}
        </Label>
        {hint ? <p className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
