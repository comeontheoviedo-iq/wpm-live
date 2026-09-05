/** Human last-sync age for LIVE desk reliability strip. */

export function formatSyncAge(
  lastFeedSyncAt: string | Date | null | undefined,
  nowMs = Date.now()
): { label: string; stale: boolean; ageMs: number | null } {
  if (!lastFeedSyncAt) {
    return { label: "Never synced", stale: true, ageMs: null };
  }
  const t = new Date(lastFeedSyncAt).getTime();
  if (!Number.isFinite(t)) {
    return { label: "Sync time unknown", stale: true, ageMs: null };
  }
  const ageMs = Math.max(0, nowMs - t);
  const sec = Math.floor(ageMs / 1000);
  let label: string;
  if (sec < 15) label = "Synced just now";
  else if (sec < 60) label = `Synced ${sec}s ago`;
  else if (sec < 3600) label = `Synced ${Math.floor(sec / 60)}m ago`;
  else label = `Synced ${Math.floor(sec / 3600)}h ago`;

  // LIVE polls ~18s — stale if > 90s without success
  const stale = ageMs > 90_000;
  return { label, stale, ageMs };
}
