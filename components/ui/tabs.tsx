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
          "border-b border-slate-200/80 bg-slate-100/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50",
        variant === "underline" &&
          "border-b border-slate-200/80 px-2 dark:border-slate-800",
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
                    ? "border-slate-300/90 bg-white text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                    : "border-transparent text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:hover:bg-slate-800/70 dark:hover:text-slate-200"
                ),
              variant === "underline" &&
                cn(
                  "rounded-t-md border-b-2 -mb-px",
                  active
                    ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                    : "border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
