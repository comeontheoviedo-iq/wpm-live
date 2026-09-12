"use client";

/**
 * Live AF events ticker for the desk.
 * Prefer feeding via sync `newEvents` so items appear before full refresh.
 * Broadcast-style leftward marquee (CSS), seamless loop, pause on hover.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ActionTickerItem = {
  id: string;
  minute: number;
  type: string;
  description: string;
  teamSide?: string | null;
};

function TickerChip({
  ev,
  isFresh,
}: {
  ev: ActionTickerItem;
  isFresh: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1 rounded-md bg-[var(--surface-elevated)] px-2 py-0.5 text-[11px] leading-tight ring-1 ring-[var(--border)] transition-colors",
        isFresh && "action-ticker-item-fresh ring-rose-400/50"
      )}
    >
      <span className="font-semibold tabular-nums text-[var(--foreground)]">
        {ev.minute}&apos;
      </span>
      <span className="uppercase tracking-wide text-[var(--muted)]">
        {ev.type.replace(/_/g, " ")}
      </span>
      <span className="text-[var(--foreground)]/90">{ev.description}</span>
    </div>
  );
}

function TickerSegment({
  items,
  freshIds,
  padKey,
  minWidth,
}: {
  items: ActionTickerItem[];
  freshIds: Set<string>;
  padKey: string;
  minWidth: number;
}) {
  return (
    <div
      className="action-ticker-segment flex shrink-0 items-center gap-2 px-2"
      style={minWidth > 0 ? { minWidth } : undefined}
    >
      {items.map((ev) => (
        <TickerChip
          key={`${padKey}-${ev.id}`}
          ev={ev}
          isFresh={freshIds.has(ev.id)}
        />
      ))}
      <span
        className="shrink-0 select-none px-1 text-[10px] text-[var(--muted)]/50"
        aria-hidden
      >
        ·
      </span>
    </div>
  );
}

export function ActionTicker({
  items,
  emptyLabel = "No live actions yet",
}: {
  items: ActionTickerItem[];
  emptyLabel?: string;
}) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [segMinWidth, setSegMinWidth] = useState(0);

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

  // Keep each loop segment at least as wide as the viewport so short lists still scroll full-width
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSegMinWidth(Math.ceil(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  // ~3.5s per chip — readable at desk size; clamp so short lists aren't frantic
  const durationSec = useMemo(() => {
    const n = Math.max(items.length, 1);
    return Math.min(72, Math.max(22, n * 3.5));
  }, [items.length]);

  // Remount track when set changes so new AF events enter the loop promptly
  const trackKey = useMemo(
    () => items.map((i) => i.id).join("|"),
    [items]
  );

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
      ref={rootRef}
      className="action-ticker-root group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]"
      data-cocomms="action-ticker"
      aria-label="Live action ticker"
      role="marquee"
    >
      <div
        key={trackKey}
        className="action-ticker-track flex w-max items-center py-1.5"
        style={{ animationDuration: `${durationSec}s` }}
      >
        <TickerSegment
          items={items}
          freshIds={freshIds}
          padKey="a"
          minWidth={segMinWidth}
        />
        <TickerSegment
          items={items}
          freshIds={freshIds}
          padKey="b"
          minWidth={segMinWidth}
        />
      </div>
    </div>
  );
}
