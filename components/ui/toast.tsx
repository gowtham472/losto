"use client";

import { AlertTriangle, Check, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn, uid } from "@/lib/utils";

type Tone = "success" | "error" | "info";

interface Toast {
  id: string;
  tone: Tone;
  message: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastValue {
  toast: (input: Omit<Toast, "id">) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const TONES: Record<Tone, { icon: typeof Check; color: string }> = {
  success: { icon: Check, color: "var(--green)" },
  error: { icon: AlertTriangle, color: "var(--red)" },
  info: { icon: Info, color: "var(--accent)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const toast = useCallback<ToastValue["toast"]>(
    (input) => {
      const id = uid("t");
      setToasts((prev) => [...prev.slice(-3), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), input.tone === "error" ? 7000 : 4000),
      );
    },
    [dismiss],
  );

  const value = useMemo<ToastValue>(
    () => ({
      toast,
      success: (message, detail) => toast({ tone: "success", message, detail }),
      error: (message, detail) => toast({ tone: "error", message, detail }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),12px)] sm:items-end sm:px-4 sm:pb-4"
      >
        {toasts.map((t) => {
          const { icon: Icon, color } = TONES[t.tone];
          return (
            <div
              key={t.id}
              className={cn(
                "animate-sheet pointer-events-auto flex w-full max-w-sm items-start gap-2.5",
                "rounded-card bg-surface p-2.5 shadow-overlay",
              )}
            >
              <span
                className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
              >
                <Icon size={12} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1 pt-px">
                <p className="text-[12.5px] font-medium leading-snug text-ink">{t.message}</p>
                {t.detail ? (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{t.detail}</p>
                ) : null}
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-1.5 text-[11.5px] font-semibold text-accent-ink hover:underline"
                  >
                    {t.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-mr-0.5 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-chip text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
