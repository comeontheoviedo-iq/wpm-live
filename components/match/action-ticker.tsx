"use client";

/**
 * Live AF events ticker for the desk.
 * Prefer feeding via sync `newEvents` so items appear before full refresh.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ActionTickerItem = {
  id: string;
  minute: number;
  type: string;
  description: string;
  teamSide?: string | null;
};

export function ActionTicker({
  items,
  emptyLabel = "No live actions yet",
}: {
  items: ActionTickerItem[];
  emptyLabel?: string;
}) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Set(items.map((i) => i.id));
    const added: string[] = [];
    for (const id of next) {
      if (!prevIdsRef.current.has(id)) added.push(id);
    }
    prevIdsRef.current = next;
    if (!added.length) return;
    setFreshIds(new Set(added));
    const t = window.setTimeout(() => setFreshIds(new Set()), 2400);
    return () => window.clearTimeout(t);
  }, [items]);

  if (!items.length) {
    return (
      <div
        className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]"
        data-cocomms="action-ticker-empty"
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]"
      data-cocomms="action-ticker"
      aria-label="Live action ticker"
    >
      <div className="flex gap-2 overflow-x-auto px-2 py-1.5 scrollbar-thin">
        {items.slice(0, 12).map((ev) => {
          const isFresh = freshIds.has(ev.id);
          return (
            <div
              key={ev.id}
              className={cn(
                "shrink-0 rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-[11px] ring-1 ring-[var(--border)] transition-colors",
                isFresh && "action-ticker-item-fresh ring-rose-400/50"
              )}
            >
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {ev.minute}&apos;
              </span>{" "}
              <span className="uppercase tracking-wide text-[var(--muted)]">
                {ev.type.replace(/_/g, " ")}
              </span>
              <span className="ml-1 text-[var(--foreground)]/90">
                {ev.description}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
