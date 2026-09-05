"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared dossier / modal header with optional crest watermark.
 * Use for player/club dossiers and centered dialogs so chrome stays consistent.
 */
export function ModalHeader({
  title,
  subtitle,
  badge,
  crestUrl,
  leading,
  actions,
  onClose,
  closeLabel = "Close",
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  crestUrl?: string | null;
  leading?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("modal-header-shell shrink-0 px-4 py-3", className)}>
      {crestUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={crestUrl} alt="" className="crest-watermark" />
      ) : null}
      <div className="relative flex items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white sm:text-xl">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle ? (
            <div className="mt-1 text-desk-xs text-slate-600 dark:text-slate-300">
              {subtitle}
            </div>
          ) : null}
          {children}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {actions}
          {onClose ? (
            <button
              type="button"
              className="focus-ring interactive-press rounded-lg p-1.5 text-slate-500 hover:bg-slate-100/90 dark:hover:bg-slate-800/90"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ModalShell({
  children,
  className,
  side = "center",
}: {
  children: ReactNode;
  className?: string;
  side?: "center" | "right";
}) {
  if (side === "right") {
    return (
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-slate-200/90 bg-slate-50 shadow-lg animate-slide-up dark:border-slate-800 dark:bg-slate-950",
          className
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in">
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-950",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
