import { prisma } from "./prisma";
import { isApiFootballConfigured } from "./api-football";
import { syncMatchFromApiFootball } from "./sync-fixture";

/** Upper bound: first observe T≤30 with small clock/cron skew buffer. */
export const PRE_KICKOFF_WINDOW_MAX_MS = 31 * 60 * 1000;
/** Still upcoming (do not hard-sync after kickoff via this path). */
export const PRE_KICKOFF_WINDOW_MIN_MS = 0;

const DONE_STATUSES = new Set([
  "Full Time",
  "Finished",
  "FT",
  "AET",
  "PEN",
  "Cancelled",
  "Canceled",
  "Abandoned",
  "Postponed",
]);

export type PreKickoffHardSyncResult = {
  ok: boolean;
  reason?: string;
  scanned: number;
  synced: Array<{
    matchId: string;
    kickoff: string;
    minutesToKickoff: number;
    lineupStatus?: string;
  }>;
  errors: Array<{ matchId: string; error: string }>;
};

/**
 * Server-side T-30 hard sync: one full AF sync per match the first time we
 * observe kickoff within ~30 minutes and preKickoffHardSyncAt is still null.
 * Idempotent via preKickoffHardSyncAt — safe for a 1–5 min cron.
 */
export async function runPreKickoffHardSync(opts?: {
  now?: Date;
  limit?: number;
}): Promise<PreKickoffHardSyncResult> {
  if (!isApiFootballConfigured()) {
    return {
      ok: false,
      reason: "API_FOOTBALL_KEY not configured",
      scanned: 0,
      synced: [],
      errors: [],
    };
  }

  const now = opts?.now ?? new Date();
  const nowMs = now.getTime();
  const windowStart = new Date(nowMs + PRE_KICKOFF_WINDOW_MIN_MS);
  const windowEnd = new Date(nowMs + PRE_KICKOFF_WINDOW_MAX_MS);
  const limit = Math.max(1, Math.min(opts?.limit ?? 5, 10));

  const candidates = await prisma.match.findMany({
    where: {
      apiFootballFixtureId: { not: null },
      preKickoffHardSyncAt: null,
      kickoff: { gt: windowStart, lte: windowEnd },
      NOT: { status: { in: [...DONE_STATUSES] } },
    },
    select: {
      id: true,
      kickoff: true,
      status: true,
      lineupStatus: true,
    },
    orderBy: { kickoff: "asc" },
    take: limit,
  });

  const synced: PreKickoffHardSyncResult["synced"] = [];
  const errors: PreKickoffHardSyncResult["errors"] = [];

  for (const match of candidates) {
    const minutesToKickoff = Math.round(
      (match.kickoff.getTime() - nowMs) / 60_000
    );
    try {
      const result = await syncMatchFromApiFootball(match.id, { mode: "full" });
      await prisma.match.update({
        where: { id: match.id },
        data: { preKickoffHardSyncAt: new Date() },
      });
      synced.push({
        matchId: match.id,
        kickoff: match.kickoff.toISOString(),
        minutesToKickoff,
        lineupStatus:
          (result as { lineupStatus?: string } | undefined)?.lineupStatus ??
          match.lineupStatus,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e || "sync failed");
      errors.push({ matchId: match.id, error: error.slice(0, 200) });
    }
  }

  return {
    ok: errors.length === 0,
    scanned: candidates.length,
    synced,
    errors,
  };
}
