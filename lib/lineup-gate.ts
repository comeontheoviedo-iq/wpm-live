/**
 * Official XI gate — keep in sync with docs/AF_LIVE_TRIGGERS.md
 *
 * AF often returns startXI before Official XI with null formation/grids.
 * Those dumps must never confirm Official or overwrite a good board.
 * Confirm only when BOTH sides look like a real Official XI (formation + grids).
 */

export type LineupLike = {
  formation?: string | null;
  startXI?:
    | {
        player?: { grid?: string | null } | null;
      }[]
    | null;
};

/**
 * True when AF payload looks like a real Official XI — not a pre-match squad dump.
 * Strasbourg–Monaco returned startXI with formation=null and grid=null;
 * treating that as confirmed mapped players by array order (mids in defence).
 */
export function isUsableOfficialLineup(
  lineup: LineupLike | null | undefined
): boolean {
  const xi = lineup?.startXI || [];
  if (xi.length < 11) return false;
  const withGrid = xi.filter((r) =>
    /^\d+:\d+$/.test(String(r.player?.grid || ""))
  ).length;
  const formation = String(lineup?.formation || "").trim();
  if (formation && withGrid >= 8) return true;
  // Formation can lag a beat behind grids on some feeds.
  if (withGrid >= 10) return true;
  return false;
}

export type LineupApplyAction =
  | "confirm"
  | "keep_predicted"
  | "fallback_last_xi"
  | "keep";

export type LineupApplyPlan = {
  action: LineupApplyAction;
  lineupStatus: string;
};

/**
 * Sync-path decision. Callers must not upsert startXI unless action is
 * "confirm" (this fixture, both sides usable) or "fallback_last_xi"
 * (last finished XI that itself passed isUsableOfficialLineup).
 */
export function planLineupApply(opts: {
  homeOfficial: boolean;
  awayOfficial: boolean;
  currentStatus: string;
  isLiveSync: boolean;
  isPreOrNs: boolean;
}): LineupApplyPlan {
  const current = opts.currentStatus || "expected";

  if (opts.homeOfficial && opts.awayOfficial) {
    return { action: "confirm", lineupStatus: "confirmed" };
  }
  if (current === "predicted") {
    return { action: "keep_predicted", lineupStatus: "predicted" };
  }
  // Live/FT Official board: a later provisional dump must not last-XI overwrite.
  // NS + wrongly-confirmed (provisional stamp) still falls through to last-XI.
  if (current === "confirmed" && !opts.isPreOrNs) {
    return { action: "keep", lineupStatus: "confirmed" };
  }
  if (!opts.isLiveSync) {
    return { action: "fallback_last_xi", lineupStatus: "expected" };
  }
  if (current === "confirmed") {
    return { action: "keep", lineupStatus: "confirmed" };
  }
  return { action: "keep", lineupStatus: current };
}
