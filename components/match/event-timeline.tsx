"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  type: string;
  minute: number;
  description: string;
  teamSide?: string | null;
  commentary?: string | null;
  playerId?: string | null;
};

function typeTone(type: string) {
  if (type.includes("goal")) return "text-emerald-700 dark:text-emerald-300";
  if (type === "yellow") return "text-amber-600 dark:text-amber-300";
  if (type === "red") return "text-rose-600 dark:text-rose-300";
  if (type === "sub") return "text-sky-700 dark:text-sky-300";
  if (type.includes("penalty")) return "text-violet-700 dark:text-violet-300";
  return "text-teal-700 dark:text-teal-300";
}

export function EventTimeline({
  events,
  highlightIds,
  compact,
  emptyLabel = "No events yet — Sync or log from the composer.",
  className,
  maxHeightClass = "max-h-[50vh]",
}: {
  events: TimelineEvent[];
  highlightIds?: Set<string> | string[];
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
  maxHeightClass?: string;
}) {
  const hi = highlightIds
    ? highlightIds instanceof Set
      ? highlightIds
      : new Set(highlightIds)
    : new Set<string>();
  const [seenFlash, setSeenFlash] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set(events.map((e) => e.id)));

  useEffect(() => {
    const next = new Set(events.map((e) => e.id));
    const fresh = [...next].filter((id) => !prevIds.current.has(id));
    if (fresh.length) {
      setSeenFlash((s) => {
        const n = new Set(s);
        fresh.forEach((id) => n.add(id));
        return n;
      });
      const t = setTimeout(() => {
        setSeenFlash((s) => {
          const n = new Set(s);
          fresh.forEach((id) => n.delete(id));
          return n;
        });
      }, 6000);
      prevIds.current = next;
      return () => clearTimeout(t);
    }
    prevIds.current = next;
  }, [events]);

  return (
    <div className={cn("space-y-1.5 overflow-y-auto", maxHeightClass, className)}>
      {events.length === 0 && (
        <p className="text-xs text-slate-500 px-1 py-2">{emptyLabel}</p>
      )}
      {events.map((e) => {
        const flash = hi.has(e.id) || seenFlash.has(e.id);
        return (
          <div
            key={e.id}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-sm transition",
              flash
                ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 animate-pulse"
                : "border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-950/40"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("font-bold tabular-nums", typeTone(e.type))}>
                {e.minute}&apos;
              </span>
              <span className="text-[9px] uppercase tracking-wide text-slate-400">
                {e.type.replace(/_/g, " ")}
                {e.teamSide ? ` · ${e.teamSide}` : ""}
              </span>
            </div>
            <div className={cn("mt-0.5 leading-snug", compact ? "text-xs" : "text-sm")}>
              {e.description}
            </div>
            {!compact && e.commentary && (
              <div className="mt-1 text-xs italic text-slate-500">{e.commentary}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
