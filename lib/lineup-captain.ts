/**
 * Official match captain — AF /fixtures/lineups often omits captain;
 * /fixtures/players statistics.games.captain is the reliable flag.
 * Never invent: only true when AF explicitly sent true.
 */

export type AfCaptainLineupRow = {
  captain?: boolean;
  player?: { id?: number | null; captain?: boolean } | null;
};

export type CaptainStatRow = {
  playerId: string | null;
  captain?: boolean;
  captainKnown?: boolean;
};

/** True only when AF lineup marks captain on the row or player. */
export function isAfLineupCaptain(
  row: AfCaptainLineupRow | null | undefined
): boolean {
  return row?.captain === true || row?.player?.captain === true;
}

export function afLineupCaptainPlayerIds(
  lineup:
    | {
        startXI?: AfCaptainLineupRow[] | null;
        substitutes?: AfCaptainLineupRow[] | null;
      }
    | null
    | undefined
): number[] {
  const ids: number[] = [];
  for (const row of [...(lineup?.startXI || []), ...(lineup?.substitutes || [])]) {
    if (!isAfLineupCaptain(row)) continue;
    const id = row.player?.id;
    if (id != null && Number.isFinite(id) && id > 0) ids.push(id);
  }
  return [...new Set(ids)];
}

/**
 * Decide whether to write isCaptain for one club from AF fixture-player rows.
 * - No known flags → do not write (don't invent / don't wipe)
 * - Known, but the only true captains failed to map → do not wipe
 * - Known with mapped ids (possibly empty) → write those, clear the rest
 */
export function planCaptainWrites(sideRows: CaptainStatRow[]): {
  apply: boolean;
  playerIds: string[];
} {
  const known = sideRows.some(
    (r) => r.captainKnown === true || r.captain === true
  );
  if (!known) return { apply: false, playerIds: [] };
  const flagged = sideRows.filter((r) => r.captain === true);
  const mapped = flagged
    .map((r) => r.playerId)
    .filter((id): id is string => Boolean(id));
  if (flagged.length > 0 && mapped.length === 0) {
    return { apply: false, playerIds: [] };
  }
  return { apply: true, playerIds: [...new Set(mapped)] };
}
