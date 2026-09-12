"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-viewport HOOKS poster — Esc-first, minimal chrome.
 * Renders inside the desk root so it covers native fullscreen too.
 */
export function HooksPosterOverlay({
  open,
  src,
  onClose,
  title = "HOOKS",
}: {
  open: boolean;
  src: string | null;
  onClose: () => void;
  title?: string;
}) {
  const close = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
    // Capture so we beat desk Esc handlers; browser may still exit FS — caller re-enters.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  if (!open || !src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-hooks-poster="1"
      className={cn(
        "fixed inset-0 z-[200] flex flex-col bg-black/95",
        "touch-none select-none"
      )}
      onClick={close}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-[201] flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 bg-white/10">
          {title}
        </span>
        <span className="text-[10px] font-medium text-white/45">
          Esc to return
        </span>
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 z-[201] rounded-md border border-white/15 bg-black/50 p-2 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label="Close HOOKS poster"
        title="Close (Esc)"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <X className="h-4 w-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="HOOKS poster"
        className="m-auto max-h-[100dvh] max-w-[100vw] object-contain p-2 sm:p-4"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
