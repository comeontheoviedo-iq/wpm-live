/**
 * Substitution allowance / window chips from AF subst events.
 * Default: FIFA-style 5 subs / 3 windows (competitive). Soft-fail when
 * competition rules differ or AF doesn't split windows — still show totals.
 */

export type SubWindowSummary = {
  used: number;
  max: number;
  remaining: number;
  /** Subs per window, e.g. [1,1,2,1] — empty when grouping is uncertain */
  windows: number[];
  /** True when window split is a heuristic, not competition-authoritative */
  windowsHeuristic: boolean;
  label: string;
};

const DEFAULT_MAX = 5;

/** Group consecutive/near-consecutive subst minutes into windows. */
export function summarizeSubWindows(
  events: { type: string; minute: number | null | undefined; teamSide?: string | null }[],
  side: "home" | "away",
  opts?: { maxSubs?: number }
): SubWindowSummary {
  const max = opts?.maxSubs ?? DEFAULT_MAX;
  const mins = events
    .filter((e) => e.type === "sub" && e.teamSide === side)
    .map((e) => (e.minute == null || !Number.isFinite(e.minute) ? null : Number(e.minute)))
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);

  // If teamSide missing on all, caller should pre-filter by club — treat all as this side
  const used = mins.length;
  const remaining = Math.max(0, max - used);

  const windows: number[] = [];
  let heuristic = false;
  if (mins.length) {
    // Window = cluster of subs within 1 minute of each other (AF often stamps same minute)
    let cluster = 1;
    for (let i = 1; i < mins.length; i++) {
      if (mins[i]! - mins[i - 1]! <= 1) {
        cluster += 1;
      } else {
        windows.push(cluster);
        cluster = 1;
      }
    }
    windows.push(cluster);
    // Soft-fail: if many singleton windows beyond 3, mark heuristic
    if (windows.length > 3) heuristic = true;
  }

  const chips = windows.length ? windows.map((n) => `[${n}]`).join("") : "";
  const label = chips
    ? `${used}/${max} ${chips}`
    : `${used}/${max}`;

  return {
    used,
    max,
    remaining,
    windows,
    windowsHeuristic: heuristic,
    label,
  };
}
