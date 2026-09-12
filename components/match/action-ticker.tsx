"use client";

/**
 * Thin scaffold: live AF events ticker for the desk.
 * Wire to sync `newEvents` / MatchEvent stream after fixture fan-in is solid.
 * Polish (animation density, filters, pinning) parked.
 */

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
        {items.slice(0, 12).map((ev) => (
          <div
            key={ev.id}
            className="shrink-0 rounded-md bg-[var(--surface-elevated)] px-2 py-1 text-[11px] ring-1 ring-[var(--border)]"
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
        ))}
      </div>
    </div>
  );
}
