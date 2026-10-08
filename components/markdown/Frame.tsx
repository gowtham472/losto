"use client";

import { Check, Copy } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { cn, copyText } from "@/lib/utils";

/**
 * The titled box that code, diagrams and drawings all sit in: a label on the
 * left, a row of small tools on the right, the content underneath.
 */
export function Frame({
  label,
  detail,
  actions,
  children,
  className,
}: {
  label: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("my-1 overflow-hidden rounded-card bg-inset shadow-hairline", className)}>
      <div className="flex h-8 items-center justify-between gap-2 bg-surface pl-3 pr-1.5 shadow-[inset_0_-1px_0_var(--line)]">
        <span className="min-w-0 truncate font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-3">
          {label}
          {detail ? (
            <span className="ml-2 normal-case tracking-normal text-ink-3/70">{detail}</span>
          ) : null}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>
      {children}
    </div>
  );
}

export function ToolButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  /** Set for a toggle; leave undefined for a plain action. */
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "flex size-6 items-center justify-center rounded-chip transition-colors",
        active ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, title = "Copy" }: { text: string | (() => string); title?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ToolButton
      title={title}
      onClick={async () => {
        if (await copyText(typeof text === "function" ? text() : text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? (
        <Check size={12} strokeWidth={2.5} className="text-green" />
      ) : (
        <Copy size={12} strokeWidth={2.2} />
      )}
    </ToolButton>
  );
}

/* -------------------------------------------------------------------------- */

const PREFERENCE_EVENT = "losto:preference";

/**
 * A yes/no choice that applies to every block of its kind at once and is
 * remembered - turning line numbers off in one code block turns them off in
 * all of them, here and next time.
 */
export function usePreference(key: string, fallback: boolean): [boolean, (next: boolean) => void] {
  const storageKey = `losto:${key}`;
  const value = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PREFERENCE_EVENT, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(PREFERENCE_EVENT, notify);
        window.removeEventListener("storage", notify);
      };
    },
    () => {
      try {
        const stored = localStorage.getItem(storageKey);
        return stored === null ? fallback : stored === "1";
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );

  const set = (next: boolean) => {
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* blocked storage: the choice lasts until the page is closed, at best */
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  };
  return [value, set];
}

/** Follows the app's theme, which lives on the root element. */
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      return () => observer.disconnect();
    },
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}
