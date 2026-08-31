"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type Variant = "default" | "primary" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  default: "bg-surface text-ink shadow-btn hover:bg-hover active:bg-hover-2",
  primary: "bg-accent text-accent-fg shadow-btn hover:opacity-90 active:opacity-100",
  ghost: "text-ink-2 hover:bg-hover hover:text-ink active:bg-hover-2",
  subtle: "bg-inset text-ink shadow-hairline hover:bg-hover",
  danger: "text-red hover:bg-red-tint",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 rounded-control px-2 text-[12.5px]",
  md: "h-8 gap-1.5 rounded-control px-2.5 text-[13px]",
  lg: "h-9 gap-2 rounded-control px-3.5 text-[13.5px]",
  icon: "size-8 rounded-control",
  "icon-sm": "size-7 rounded-control",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-medium",
        "transition-[background-color,box-shadow,color,opacity] duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Chip - filters, tags, counts                                               */
/* -------------------------------------------------------------------------- */

export function Chip({
  children,
  active,
  className,
  tone,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 shrink-0 select-none items-center gap-1.5 rounded-full px-3.5",
        "text-[12.5px] font-medium transition-[background-color,box-shadow,color] duration-150",
        active
          ? "bg-ink text-page shadow-btn"
          : "bg-surface text-ink-2 shadow-btn hover:bg-hover hover:text-ink",
        className,
      )}
      style={active && tone ? { background: tone, color: "var(--accent-fg)" } : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center rounded-chip bg-inset px-1.5",
        "text-[10.5px] font-medium text-ink-2 shadow-hairline",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = "var(--ink-2)",
  tint,
  className,
}: {
  children: ReactNode;
  tone?: string;
  tint?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[20px] items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.04em]",
        className,
      )}
      style={{ color: tone, background: tint ?? "color-mix(in oklch, currentColor 12%, transparent)" }}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Fields                                                                     */
/* -------------------------------------------------------------------------- */

export const Field = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Field({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-control bg-field px-3 text-[13.5px] text-ink",
          "shadow-hairline transition-shadow duration-150",
          "focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--accent),0_0_0_3px_var(--accent-tint)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full resize-none rounded-control bg-field p-3 text-[13.5px] leading-relaxed text-ink",
          "shadow-hairline transition-shadow duration-150",
          "focus:outline-none focus-visible:shadow-[0_0_0_1px_var(--accent),0_0_0_3px_var(--accent-tint)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

/**
 * "sm" is for a control sitting in a labelled settings row, where the label
 * beside it carries the height. Everywhere else the segmented control *is* the
 * control, and needs a proper touch target on a phone.
 */
const SEGMENT_SIZES = {
  sm: { pad: "p-0.5", button: "h-7 gap-1.5 px-2.5 text-[12.5px]" },
  md: { pad: "p-1", button: "h-9 gap-2 px-3.5 text-[13px]" },
} as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof SEGMENT_SIZES;
  className?: string;
}) {
  const dims = SEGMENT_SIZES[size];
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control bg-inset shadow-hairline",
        dims.pad,
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-[6px]",
              dims.button,
              "font-medium transition-[background-color,box-shadow,color] duration-150",
              active
                ? "bg-surface text-ink shadow-btn"
                : "text-ink-3 hover:text-ink-2",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  raised,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface",
        raised ? "shadow-raised" : "shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Well({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-card bg-inset shadow-hairline", className)}>{children}</div>;
}

export function SectionTitle({
  index,
  children,
  action,
}: {
  index?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2">
        {index ? (
          <span className="font-mono text-[10.5px] tabnums text-ink-3">{index}</span>
        ) : null}
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
          {children}
        </h2>
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent",
        "animate-[losto-spin_0.6s_linear_infinite] opacity-70",
        className,
      )}
      style={{ animation: "losto-spin 0.6s linear infinite" }}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-chip", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-well px-6 py-14 text-center",
        "stripes",
        className,
      )}
    >
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-well bg-surface text-ink-3 shadow-card">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[38ch] text-[12.5px] leading-relaxed text-ink-2">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
