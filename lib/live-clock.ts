/**
 * Live match clock helpers — AF fixture.status.elapsed + status.extra (stoppage).
 * Honest when stoppage is missing: show elapsed only (e.g. 90').
 */

export function formatLiveClock(
  elapsed: number | null | undefined,
  extra: number | null | undefined,
  opts?: { status?: string | null }
): string {
  const st = (opts?.status || "").toLowerCase();
  if (st === "full time" || st === "ft") return "FT";
  if (st === "half time" || st === "ht") return "HT";
  if (elapsed == null || !Number.isFinite(elapsed)) return "";
  const e = Math.max(0, Math.floor(elapsed));
  if (extra != null && Number.isFinite(extra) && extra > 0) {
    return `${e}'+${Math.floor(extra)}`;
  }
  return `${e}'`;
}

/** Pitch / badge short label including stoppage when AF provides it. */
export function formatPitchClockBadge(
  elapsed: number | null | undefined,
  extra: number | null | undefined,
  statusShort: string | null | undefined
): string | null {
  if (statusShort === "FT" || statusShort === "HT") return statusShort;
  if (statusShort === "LIVE" || statusShort === "1H" || statusShort === "2H") {
    const clock = formatLiveClock(elapsed, extra);
    if (clock) return clock;
    return statusShort;
  }
  return statusShort || null;
}
