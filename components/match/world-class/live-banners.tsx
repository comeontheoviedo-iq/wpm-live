"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveBanner } from "@/lib/live-banners";

export function LiveBannersBar({
  banners,
  onPlayerClick,
  onDismiss,
}: {
  banners: LiveBanner[];
  onPlayerClick?: (playerId: string) => void;
  onDismiss?: (id: string) => void;
}) {
  if (!banners.length) return null;
  return (
    <div className="flex flex-col gap-1 px-1">
      {banners.map((b) => (
        <div
          key={b.id}
          className={cn(
            "rounded-lg border px-2.5 py-1.5 text-[11px] shadow-sm",
            b.tone === "violet" &&
              "border-violet-400 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-100",
            b.tone === "amber" &&
              "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100",
            b.tone === "sky" &&
              "border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-100"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="font-bold uppercase tracking-wide text-[10px] opacity-80">
              {b.title}
            </div>
            {onDismiss ? (
              <button
                type="button"
                className="shrink-0 rounded p-1.5 opacity-70 hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                title="Dismiss banner"
                aria-label="Dismiss banner"
                onClick={() => onDismiss(b.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="mt-0.5 leading-snug">{b.detail}</div>
          {b.kind === "one_away" && onPlayerClick && (
            <div className="mt-1 flex flex-wrap gap-1">
              {b.playerIds.slice(0, 4).map((id) => (
                <button
                  key={id}
                  type="button"
                  className="rounded border border-amber-300/80 px-1.5 py-px text-[10px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  onClick={() => onPlayerClick(id)}
                >
                  Open
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
