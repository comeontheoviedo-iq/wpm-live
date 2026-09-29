/**
 * Overview Career block — surface existing career rows (apps/G/A + club history)
 * on the player dossier Overview tab for both club and international desks.
 *
 * Does not invent stats.
 *
 * International desks: CAPS/G/A come from ONE canonical source — Player.appearances /
 * goals / assists (written by sync via aggregateInternationalCareerTotals: all senior
 * NT comps incl. friendlies). Same numbers as pitch cards. Never sum career.clubs NT
 * stints (youth/other NTs double-count; /players?id= rows can diverge from team-page
 * career tallies).
 *
 * Club desks: sum non-NT career.clubs (ex-friendlies).
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
 * Build the Overview Career summary.
 * Intl desks → Player.* career NT caps (identical to pitch CAPS/G/A).
 * Club desks → sum club career stints.
 */
export function buildOverviewCareerBlock(opts: {
  clubs: OverviewCareerClubRow[] | null | undefined;
  internationalDesk: boolean;
  /** Canonical pitch/card totals — required path on intl desks. */
  playerFallback?: {
    appearances: number;
    goals: number;
    assists: number;
  } | null;
}): OverviewCareerBlock {
  const clubs = opts.clubs || [];
  const clubRows = clubs.filter((c) => !c.nationalTeam);

  if (opts.internationalDesk) {
    const fb = opts.playerFallback;
    // Always prefer Player.* when provided — even zeros — so profile == pitch card.
    // Do not sum ntRows from career.clubs (divergent / double-counting).
    const hasFb = fb != null;
    return {
      hasData: hasFb || clubRows.length > 0,
      appsLabel: "Caps",
      scopeHint: "international · incl. friendlies",
      apps: hasFb ? fb!.appearances : null,
      goals: hasFb ? fb!.goals : null,
      assists: hasFb ? fb!.assists : null,
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
