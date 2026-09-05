/**
 * Season goal/assist tallies from AF /players statistics.
 * Competition (league) row vs all club competitions this season.
 * Never invents — returns nulls / notes when AF gaps exist.
 */

import { getPlayerById, type AfTopScorer } from "./api-football";

export function ordinal(n: number): string {
  const v = Math.floor(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1:
      return `${v}st`;
    case 2:
      return `${v}nd`;
    case 3:
      return `${v}rd`;
    default:
      return `${v}th`;
  }
}

export type SeasonStatSplit = {
  competitionName: string;
  competitionGoals: number | null;
  competitionAssists: number | null;
  allCompGoals: number | null;
  allCompAssists: number | null;
  /** True when AF only returned a single competition row for this club/season */
  leagueLimited: boolean;
  rowCount: number;
};

function clubRows(
  stats: AfTopScorer["statistics"] | undefined,
  teamAfId?: number | null
) {
  const rows = stats || [];
  if (teamAfId == null) return rows;
  const forTeam = rows.filter((s) => s.team?.id === teamAfId);
  return forTeam.length ? forTeam : rows;
}

/** Split AF player season statistics into this-league vs all club comps. */
export function splitSeasonStats(
  statistics: AfTopScorer["statistics"] | undefined,
  leagueId: number,
  competitionName: string,
  teamAfId?: number | null
): SeasonStatSplit {
  const rows = clubRows(statistics, teamAfId);
  const leagueRow = rows.find((s) => s.league?.id === leagueId) || null;
  let allG = 0;
  let allA = 0;
  let any = false;
  for (const s of rows) {
    // Skip pure national-team rows when we have club rows (teamAfId matched)
    const g = s.goals?.total;
    const a = s.goals?.assists;
    if (g != null) {
      allG += g;
      any = true;
    }
    if (a != null) {
      allA += a;
      any = true;
    }
  }
  const compG = leagueRow?.goals?.total ?? null;
  const compA = leagueRow?.goals?.assists ?? null;
  return {
    competitionName:
      leagueRow?.league?.name?.trim() || competitionName || "This competition",
    competitionGoals: compG,
    competitionAssists: compA,
    allCompGoals: any ? allG : null,
    allCompAssists: any ? allA : null,
    leagueLimited: rows.length <= 1,
    rowCount: rows.length,
  };
}

/**
 * Ordinal for this event in the competition this season.
 * AF season stats often lag live/multi-goal games — combine with in-match count.
 *
 * - While LIVE: treat AF as excluding this match → af + indexInMatch
 * - When FT (or AF already ≥ in-match): treat AF as including this match →
 *   af - inMatch + indexInMatch
 */
export function seasonOrdinal(
  afTotal: number | null | undefined,
  inMatchCount: number,
  indexInMatch: number,
  matchStatus: string
): number | null {
  if (afTotal == null || !Number.isFinite(afTotal)) return null;
  if (indexInMatch < 1) return null;
  const inMatch = Math.max(0, inMatchCount);
  const live =
    matchStatus === "Live" ||
    matchStatus === "Half Time" ||
    /^(1H|2H|LIVE|HT)$/i.test(matchStatus);
  if (live || afTotal < inMatch) {
    return afTotal + indexInMatch;
  }
  return afTotal - inMatch + indexInMatch;
}

export type PopupSeasonLines = {
  lines: string[];
  competitionOrdinal: number | null;
  allCompTotal: number | null;
};

export function buildGoalSeasonLines(opts: {
  kind: "goal" | "assist";
  split: SeasonStatSplit;
  inMatchCount: number;
  indexInMatch: number;
  matchStatus: string;
}): PopupSeasonLines {
  const { kind, split, inMatchCount, indexInMatch, matchStatus } = opts;
  const isGoal = kind === "goal";
  const afComp = isGoal ? split.competitionGoals : split.competitionAssists;
  const afAll = isGoal ? split.allCompGoals : split.allCompAssists;
  const noun = isGoal ? "goal" : "assist";
  const nouns = isGoal ? "goals" : "assists";
  const lines: string[] = [];

  const nth = seasonOrdinal(afComp, inMatchCount, indexInMatch, matchStatus);
  if (nth != null) {
    lines.push(
      `${ordinal(nth)} in ${split.competitionName} this season`
    );
  } else {
    lines.push(
      `${split.competitionName} ${noun} tally unavailable from feed`
    );
  }

  // All competitions: AF club total + in-match adjustment (same heuristic)
  const allNth = seasonOrdinal(afAll, inMatchCount, indexInMatch, matchStatus);
  if (allNth != null) {
    const nWord = allNth === 1 ? noun : nouns;
    const label =
      split.leagueLimited && split.rowCount <= 1
        ? `${allNth} ${nWord} all competitions this season (AF: league row only)`
        : `${allNth} ${nWord} all competitions this season`;
    lines.push(label);
  } else if (afComp != null && nth != null) {
    lines.push(
      `All-competitions ${noun} total unavailable from feed`
    );
  }

  return {
    lines,
    competitionOrdinal: nth,
    allCompTotal: allNth,
  };
}

export async function fetchPlayerSeasonSplit(
  apiPlayerId: number,
  season: number,
  leagueId: number,
  competitionName: string,
  teamAfId?: number | null
): Promise<SeasonStatSplit | null> {
  const rows = await getPlayerById(apiPlayerId, season).catch(() => []);
  const stats = rows[0]?.statistics;
  if (!stats?.length) {
    return {
      competitionName,
      competitionGoals: null,
      competitionAssists: null,
      allCompGoals: null,
      allCompAssists: null,
      leagueLimited: true,
      rowCount: 0,
    };
  }
  return splitSeasonStats(stats, leagueId, competitionName, teamAfId);
}

/** Aggregate goals/assists from an AF player statistics array for sync ingest. */
export function aggregateForIngest(
  statistics: AfTopScorer["statistics"] | undefined,
  leagueId: number,
  teamAfId?: number | null
): {
  leagueGoals: number;
  leagueAssists: number;
  leagueApps: number;
  allGoals: number;
  allAssists: number;
  allApps: number;
  position: string | null;
} {
  const rows = clubRows(statistics, teamAfId);
  const leagueRow = rows.find((s) => s.league?.id === leagueId) || null;
  // Prefer league row; if missing, fall back to max single-row (not wrong [0] cup)
  const primary =
    leagueRow ||
    [...rows].sort(
      (a, b) => (b.goals?.total || 0) - (a.goals?.total || 0)
    )[0] ||
    null;

  let allGoals = 0;
  let allAssists = 0;
  let allApps = 0;
  for (const s of rows) {
    allGoals += s.goals?.total ?? 0;
    allAssists += s.goals?.assists ?? 0;
    allApps += s.games?.appearences ?? 0;
  }

  return {
    leagueGoals: primary?.goals?.total ?? 0,
    leagueAssists: primary?.goals?.assists ?? 0,
    leagueApps: primary?.games?.appearences ?? 0,
    allGoals,
    allAssists,
    allApps,
    position: primary?.games?.position || rows[0]?.games?.position || null,
  };
}
