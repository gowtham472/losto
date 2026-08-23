"use client";

import {
  BookOpen,
  CloudOff,
  FolderClosed,
  GraduationCap,
  Library,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { COLLECTION_COLORS } from "@/lib/sources";
import { useLibrary, useOnline } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Library", icon: Library, exact: true },
  { href: "/search", label: "Search", icon: Search },
  { href: "/collections", label: "Subjects", icon: FolderClosed },
  { href: "/study", label: "Study", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The reader and a running study session take over the whole screen; both
  // carry their subject in the query string, so match on the path exactly.
  const immersive = pathname === "/chat" || pathname === "/study/session";

  if (immersive) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <DesktopSidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="flex-1 pb-24 lg:pb-10">{children}</main>
      </div>
      <MobileNav pathname={pathname} />
    </div>
  );
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-orange-tint px-4 py-1.5 text-[11.5px] font-medium text-orange">
      <CloudOff size={12} strokeWidth={2.2} />
      Offline - your saved chats are all still here.
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DesktopSidebar({ pathname }: { pathname: string }) {
  const { chats, collections } = useLibrary();

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const chat of chats) {
      if (chat.archived) continue;
      const key = chat.collectionId ?? "none";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [chats]);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col gap-1 border-r border-line bg-canvas px-3 py-4 lg:flex">
      <Link href="/" className="mb-3 flex items-center gap-2 px-2">
        <Wordmark />
      </Link>

      <Link
        href="/import"
        className={cn(
          "mb-2 flex h-9 items-center justify-center gap-1.5 rounded-control bg-accent",
          "text-[13px] font-semibold text-accent-fg shadow-btn transition-opacity hover:opacity-90",
        )}
      >
        <Plus size={14} strokeWidth={2.5} />
        Add a chat
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-surface text-ink shadow-btn"
                  : "text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              <item.icon size={14} strokeWidth={2.1} className={active ? "text-accent" : ""} />
              {item.label}
              {item.href === "/" && chats.length ? (
                <span className="ml-auto font-mono text-[10.5px] tabnums text-ink-3">
                  {chats.filter((c) => !c.archived).length}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {collections.length ? (
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto no-scrollbar">
          <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Subjects
          </p>
          <div className="flex flex-col gap-0.5">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/?collection=${collection.id}`}
                className="flex h-7 items-center gap-2 rounded-control px-2.5 text-[12.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: COLLECTION_COLORS[collection.color] ?? "var(--ink-3)" }}
                />
                <span className="truncate">{collection.name}</span>
                <span className="ml-auto font-mono text-[10.5px] tabnums text-ink-3">
                  {counts.get(collection.id) ?? 0}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <p className="px-2.5 pt-3 text-[10.5px] leading-relaxed text-ink-3">
        Everything is stored on this device.
      </p>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */

function MobileNav({ pathname }: { pathname: string }) {
  const items = [
    { href: "/", label: "Library", icon: Library, exact: true },
    { href: "/search", label: "Search", icon: Search },
    { href: "/import", label: "Add", icon: Plus, primary: true },
    { href: "/study", label: "Study", icon: GraduationCap },
    { href: "/settings", label: "More", icon: Settings2 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/85 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          if (item.primary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label="Add a chat"
                className="flex flex-1 flex-col items-center justify-center gap-1"
              >
                <span className="flex size-9 items-center justify-center rounded-[11px] bg-accent text-accent-fg shadow-btn transition-transform active:scale-95">
                  <item.icon size={17} strokeWidth={2.6} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 rounded-control py-1 transition-colors",
                active ? "text-ink" : "text-ink-3",
              )}
            >
              <item.icon size={17} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[9.5px] font-semibold tracking-[0.01em]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* -------------------------------------------------------------------------- */

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex size-7 items-center justify-center rounded-[9px] bg-ink text-page shadow-btn">
        <BookOpen size={14} strokeWidth={2.4} />
      </span>
      <span className="font-display text-[17px] font-bold leading-none tracking-[-0.04em] text-ink">
        losto
      </span>
    </span>
  );
}

/** Standard page header used by every non-immersive route. */
export function PageHeader({
  title,
  subtitle,
  actions,
  sticky = true,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "z-30 bg-page/90 backdrop-blur-xl",
        sticky && "sticky top-0",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-end justify-between gap-3 px-4 pb-3 pt-4 lg:px-8 lg:pt-7">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-bold leading-none tracking-[-0.035em] text-ink lg:text-[26px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 truncate text-[12.5px] text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
    </header>
  );
}
