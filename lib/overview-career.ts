/**
 * Overview Career block — surface existing career rows (apps/G/A + club history)
 * on the player dossier Overview tab for both club and international desks.
 *
 * Does not invent stats. Uses career.clubs from the player API (already
 * aggregated: NT stints include friendlies; club stints exclude them).
 * Overview notes stay Verdict-only; editing stays on Notes.
 */

export type OverviewCareerClubRow = {
  teamId: number | null;
  name: string;
  logo?: string | null;
  seasons: number[];
  apps: number;
  goals: number;
  assists: number;
  nationalTeam?: boolean;
};

export type OverviewCareerBlock = {
  hasData: boolean;
  appsLabel: "Caps" | "Apps";
  scopeHint: string;
  apps: number | null;
  goals: number | null;
  assists: number | null;
  /** Non-NT club stints for the history list (both desk types when available). */
  clubHistory: OverviewCareerClubRow[];
};

function sumRows(rows: OverviewCareerClubRow[]): {
  apps: number;
  goals: number;
  assists: number;
} {
  let apps = 0;
  let goals = 0;
  let assists = 0;
  for (const r of rows) {
    apps += r.apps || 0;
    goals += r.goals || 0;
    assists += r.assists || 0;
  }
  return { apps, goals, assists };
}

/**
 * Build the Overview Career summary from existing career club rows.
 * Intl desks → NT caps (friendlies already in row totals); club desks → club career.
 * Optional playerFallback is only used on intl desks when no NT stint rows exist
 * (Player.appearances/G/A are career caps there per INTL_CAPS).
 */
export function buildOverviewCareerBlock(opts: {
  clubs: OverviewCareerClubRow[] | null | undefined;
  internationalDesk: boolean;
  playerFallback?: {
    appearances: number;
    goals: number;
    assists: number;
  } | null;
}): OverviewCareerBlock {
  const clubs = opts.clubs || [];
  const ntRows = clubs.filter((c) => c.nationalTeam);
  const clubRows = clubs.filter((c) => !c.nationalTeam);

  if (opts.internationalDesk) {
    const fromNt = ntRows.length > 0 ? sumRows(ntRows) : null;
    const fb = opts.playerFallback;
    const useFb =
      !fromNt &&
      fb != null &&
      (fb.appearances > 0 || fb.goals > 0 || fb.assists > 0);
    const totals = fromNt
      ? fromNt
      : useFb
        ? {
            apps: fb!.appearances,
            goals: fb!.goals,
            assists: fb!.assists,
          }
        : null;
    const hasTotals = totals != null;
    return {
      hasData: hasTotals || clubRows.length > 0,
      appsLabel: "Caps",
      scopeHint: "international · incl. friendlies",
      apps: hasTotals ? totals!.apps : null,
      goals: hasTotals ? totals!.goals : null,
      assists: hasTotals ? totals!.assists : null,
      clubHistory: clubRows,
    };
  }

  const totals = clubRows.length > 0 ? sumRows(clubRows) : null;
  return {
    hasData: clubRows.length > 0,
    appsLabel: "Apps",
    scopeHint: "club · ex-friendlies",
    apps: totals ? totals.apps : null,
    goals: totals ? totals.goals : null,
    assists: totals ? totals.assists : null,
    clubHistory: clubRows,
  };
}
