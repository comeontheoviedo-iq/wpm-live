"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type TabItem<T extends string = string> = {
  key: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
};

export function TabStrip<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "sm",
  variant = "chip",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  size?: "sm" | "md";
  variant?: "chip" | "underline";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto",
        variant === "chip" &&
          "border-b border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2",
        variant === "underline" &&
          "border-b border-[var(--border)] px-2",
        className
      )}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            title={item.title || (item.disabled ? "Coming soon" : undefined)}
            onClick={() => !item.disabled && onChange(item.key)}
            className={cn(
              "tab-chip focus-ring whitespace-nowrap font-semibold",
              size === "sm" && "px-2.5 py-1.5 text-[11px]",
              size === "md" && "px-3 py-2 text-desk-sm",
              item.disabled && "cursor-not-allowed opacity-40",
              variant === "chip" &&
                cn(
                  "rounded-md border",
                  active
                    ? "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                    : "border-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                ),
              variant === "underline" &&
                cn(
                  "rounded-t-md border-b-2 -mb-px",
                  active
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
                )
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
