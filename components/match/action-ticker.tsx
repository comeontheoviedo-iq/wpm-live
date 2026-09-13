"use client";

/**
 * Live AF events ticker for the desk.
 * Prefer feeding via sync `newEvents` so items appear before full refresh.
 * Broadcast-style leftward marquee (CSS), seamless loop, pause on hover / panel open.
 * Compact All/Goals/Cards/Subs filters + one pinned event slot.
 * Chip click → event detail panel; pin glyph → pin slot (filters/pin preserved).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionTickerItem = {
  id: string;
  minute: number;
  type: string;
  description: string;
  teamSide?: string | null;
  playerId?: string | null;
};

export type ActionTickerFilter = "all" | "goals" | "cards" | "subs";

const FILTERS: { id: ActionTickerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "goals", label: "Goals" },
  { id: "cards", label: "Cards" },
  { id: "subs", label: "Subs" },
];

const FILTER_STORAGE = "cocomms.actionTicker.filter";
const PIN_STORAGE_PREFIX = "cocomms.actionTicker.pin.";

export function eventStableKey(ev: ActionTickerItem): string {
  return `${ev.minute}|${ev.type}|${ev.description}`;
}

function matchesFilter(type: string, filter: ActionTickerFilter): boolean {
  if (filter === "all") return true;
  if (filter === "goals") {
    return /^(goal|penalty_goal|own_goal)$/i.test(type);
  }
  if (filter === "cards") {
    return /^(yellow|red)$/i.test(type);
  }
  if (filter === "subs") {
    return /^sub$/i.test(type);
  }
  return true;
}

function isGoalType(type: string): boolean {
  return /^(goal|penalty_goal|own_goal)$/i.test(type);
}

function isDetailType(type: string): boolean {
  return /^(goal|penalty_goal|own_goal|yellow|red|sub)$/i.test(type);
}

function readFilter(): ActionTickerFilter {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE);
    if (raw === "goals" || raw === "cards" || raw === "subs" || raw === "all") {
      return raw;
    }
  } catch {
    /* soft-fail */
  }
  return "all";
}

function writeFilter(filter: ActionTickerFilter) {
  try {
    sessionStorage.setItem(FILTER_STORAGE, filter);
  } catch {
    /* soft-fail */
  }
}

function readPinKey(matchId?: string): string | null {
  if (!matchId) return null;
  try {
    return sessionStorage.getItem(`${PIN_STORAGE_PREFIX}${matchId}`);
  } catch {
    return null;
  }
}

function writePinKey(matchId: string | undefined, key: string | null) {
  if (!matchId) return;
  try {
    const k = `${PIN_STORAGE_PREFIX}${matchId}`;
    if (key) sessionStorage.setItem(k, key);
    else sessionStorage.removeItem(k);
  } catch {
    /* soft-fail */
  }
}

function TickerChip({
  ev,
  isFresh,
  pinned,
  onPin,
  onOpen,
  interactive,
}: {
  ev: ActionTickerItem;
  isFresh: boolean;
  pinned?: boolean;
  onPin?: () => void;
  onOpen?: () => void;
  interactive?: boolean;
}) {
  const canOpen = Boolean(onOpen && isDetailType(ev.type));
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-baseline gap-0.5 rounded-md bg-[var(--surface-elevated)] py-0.5 pl-2 pr-0.5 text-left text-[11px] leading-tight ring-1 ring-[var(--border)] transition-colors",
        isFresh && "action-ticker-item-fresh ring-rose-400/50",
        pinned && "action-ticker-item-pinned ring-amber-400/60"
      )}
    >
      <button
        type="button"
        onClick={canOpen ? onOpen : interactive ? onPin : undefined}
        title={
          canOpen
            ? "Open event detail"
            : interactive
              ? pinned
                ? "Pinned — click pin to unpin"
                : "Pin this event"
              : undefined
        }
        className={cn(
          "inline-flex items-baseline gap-1 rounded-sm text-left",
          (canOpen || interactive) && "cursor-pointer hover:opacity-90",
          !canOpen && !interactive && "cursor-default"
        )}
      >
        <span className="font-semibold tabular-nums text-[var(--foreground)]">
          {ev.minute}&apos;
        </span>
        <span className="uppercase tracking-wide text-[var(--muted)]">
          {ev.type.replace(/_/g, " ")}
        </span>
        <span className="text-[var(--foreground)]/90">{ev.description}</span>
      </button>
      {interactive && onPin ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          title={pinned ? "Unpin" : "Pin this event"}
          aria-label={pinned ? "Unpin event" : "Pin event"}
          className={cn(
            "ml-0.5 rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-amber-500",
            pinned && "text-amber-500"
          )}
        >
          <Pin className={cn("h-2.5 w-2.5", pinned && "fill-amber-400")} />
        </button>
      ) : null}
    </div>
  );
}

function TickerSegment({
  items,
  freshIds,
  padKey,
  minWidth,
  onPin,
  onOpen,
}: {
  items: ActionTickerItem[];
  freshIds: Set<string>;
  padKey: string;
  minWidth: number;
  onPin: (ev: ActionTickerItem) => void;
  onOpen?: (ev: ActionTickerItem) => void;
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
          interactive
          onPin={() => onPin(ev)}
          onOpen={onOpen ? () => onOpen(ev) : undefined}
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
  matchId,
  paused,
  onEventOpen,
}: {
  items: ActionTickerItem[];
  emptyLabel?: string;
  matchId?: string;
  /** Pause marquee (e.g. while event detail panel is open) */
  paused?: boolean;
  onEventOpen?: (ev: ActionTickerItem) => void;
}) {
  const prevIdsRef = useRef<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [segMinWidth, setSegMinWidth] = useState(0);
  const [filter, setFilter] = useState<ActionTickerFilter>("all");
  const [pinKey, setPinKey] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setFilter(readFilter());
    setPinKey(readPinKey(matchId));
    hydratedRef.current = true;
  }, [matchId]);

  const setFilterPersist = useCallback((next: ActionTickerFilter) => {
    setFilter(next);
    writeFilter(next);
  }, []);

  const setPinPersist = useCallback(
    (key: string | null) => {
      setPinKey(key);
      writePinKey(matchId, key);
    },
    [matchId]
  );

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

  const pinned = useMemo(() => {
    if (!pinKey) return null;
    return items.find((i) => eventStableKey(i) === pinKey) ?? null;
  }, [items, pinKey]);

  // Drop stale pin if the event left the ticker window
  useEffect(() => {
    if (!pinKey || !hydratedRef.current) return;
    if (items.some((i) => eventStableKey(i) === pinKey)) return;
    if (items.length > 0) setPinPersist(null);
  }, [items, pinKey, setPinPersist]);

  const filtered = useMemo(
    () => items.filter((i) => matchesFilter(i.type, filter)),
    [items, filter]
  );

  const scrollItems = useMemo(() => {
    if (!pinKey) return filtered;
    return filtered.filter((i) => eventStableKey(i) !== pinKey);
  }, [filtered, pinKey]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setSegMinWidth(Math.ceil(el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollItems.length, pinned?.id, filter]);

  const durationSec = useMemo(() => {
    const n = Math.max(scrollItems.length, 1);
    return Math.min(72, Math.max(22, n * 3.5));
  }, [scrollItems.length]);

  const trackKey = useMemo(
    () => scrollItems.map((i) => i.id).join("|"),
    [scrollItems]
  );

  const handlePinToggle = useCallback(
    (ev: ActionTickerItem) => {
      const key = eventStableKey(ev);
      setPinPersist(pinKey === key ? null : key);
    },
    [pinKey, setPinPersist]
  );

  const filterBar = (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-md bg-[var(--surface)]/60 p-0.5 ring-1 ring-[var(--border)]/80"
      role="tablist"
      aria-label="Action filter"
    >
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={filter === f.id}
          onClick={() => setFilterPersist(f.id)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
            filter === f.id
              ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-sm ring-1 ring-[var(--border)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  if (!items.length) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-2 py-1.5"
        data-cocomms="action-ticker-empty"
      >
        {filterBar}
        <span className="text-[11px] text-[var(--muted)]">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-1"
      data-cocomms="action-ticker"
      aria-label="Live action ticker"
    >
      {filterBar}

      {pinned && (
        <div
          className="flex shrink-0 items-center gap-1 border-r border-[var(--border)] pr-1.5"
          data-cocomms="action-ticker-pin"
        >
          <span
            className="select-none text-[9px] font-bold uppercase tracking-wider text-amber-600/90 dark:text-amber-300/90"
            aria-hidden
          >
            Pin
          </span>
          <TickerChip
            ev={pinned}
            isFresh={freshIds.has(pinned.id)}
            pinned
            interactive
            onPin={() => setPinPersist(null)}
            onOpen={onEventOpen ? () => onEventOpen(pinned) : undefined}
          />
          <button
            type="button"
            onClick={() => setPinPersist(null)}
            className="rounded px-1 py-0.5 text-[10px] font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            title="Unpin"
            aria-label="Unpin event"
          >
            ×
          </button>
        </div>
      )}

      {!pinned && items.some((i) => isGoalType(i.type)) && (
        <button
          type="button"
          onClick={() => {
            const newest = [...items]
              .filter((i) => isGoalType(i.type))
              .sort((a, b) => b.minute - a.minute || b.id.localeCompare(a.id))[0];
            if (newest) setPinPersist(eventStableKey(newest));
          }}
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)]/70 hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          title="Pin latest goal"
        >
          Pin goal
        </button>
      )}

      <div
        ref={rootRef}
        className={cn(
          "action-ticker-root group relative min-w-0 flex-1 overflow-hidden",
          paused && "action-ticker-paused"
        )}
        role="marquee"
      >
        {scrollItems.length === 0 ? (
          <div className="px-2 py-0.5 text-[11px] text-[var(--muted)]">
            {filter === "all" ? emptyLabel : `No ${filter} in ticker`}
          </div>
        ) : (
          <div
            key={trackKey}
            className="action-ticker-track flex w-max items-center py-0.5"
            style={{
              animationDuration: `${durationSec}s`,
              animationPlayState: paused ? "paused" : undefined,
            }}
          >
            <TickerSegment
              items={scrollItems}
              freshIds={freshIds}
              padKey="a"
              minWidth={segMinWidth}
              onPin={handlePinToggle}
              onOpen={onEventOpen}
            />
            <TickerSegment
              items={scrollItems}
              freshIds={freshIds}
              padKey="b"
              minWidth={segMinWidth}
              onPin={handlePinToggle}
              onOpen={onEventOpen}
            />
          </div>
        )}
      </div>
    </div>
  );
}
