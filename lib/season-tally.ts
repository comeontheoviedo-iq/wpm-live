/**
 * Season goal/assist tallies from AF /players statistics.
 * Competition (league) row vs all club competitions this season.
 * Never invents — returns nulls / notes when AF gaps exist.
 */

import { getPlayerById, type AfTopScorer } from "./api-football";

/** Club/international friendlies — excluded from season TOTAL aggregations. */
export function isFriendlyCompetition(leagueName?: string | null): boolean {
  return /\bfriendl/i.test(leagueName || "");
}

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
  // Never fall back to another club / NT row — that caused Fernandez-Pardo
  // Newcastle APP=3 from Belgium World Cup when AF had no Newcastle season row yet.
  return rows.filter((s) => s.team?.id === teamAfId);
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
    // Skip friendlies from all-competitions season totals
    if (isFriendlyCompetition(s.league?.name)) continue;
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


/**
 * Display-time season total including today's match contribution.
 *
 * Contract: Player.goals / assists / appearances are the AF season snapshot
 * (sync does not live-bump them). While the match is in progress, treat the
 * snapshot as excluding today and add inMatch. After FT, trust the snapshot
 * unless it still clearly lags (af < inMatch).
 *
 * Soft-fail: null/NaN AF → just inMatch (or 0).
 * forceExcludeToday: while LIVE, treat AF as excluding today (APP +1 when on).
 * Prematch: callers must pass inMatchCount=0 — Official XI must NOT +1 APP yet.
 */
export function liveAdjustedSeasonStat(
  afTotal: number | null | undefined,
  inMatchCount: number,
  matchStatus?: string | null,
  opts?: {
    forceExcludeToday?: boolean;
    /** Desk/DB AF snapshot before this enrich — detects mid-match AF catch-up. */
    deskBaseline?: number | null;
  }
): number {
  const inMatch = Math.max(0, Number(inMatchCount) || 0);
  const af =
    afTotal != null && Number.isFinite(Number(afTotal)) ? Number(afTotal) : null;
  if (af == null) return inMatch;
  if (inMatch <= 0) return af;
  // AF/DB clearly behind this match's events (also covers FT lag)
  if (af < inMatch) return af + inMatch;
  const st = matchStatus || "";
  const live =
    st === "Live" ||
    st === "Half Time" ||
    /^(1H|2H|LIVE|HT|ET|BT|P|PEN)$/i.test(st);
  const desk =
    opts?.deskBaseline != null && Number.isFinite(Number(opts.deskBaseline))
      ? Number(opts.deskBaseline)
      : null;
  // Fresh AF already includes today's contribution (caught up past desk baseline)
  if (desk != null && af >= desk + inMatch) {
    return af;
  }
  // Live (or forceExcludeToday while live): snapshot excludes today
  if (live || opts?.forceExcludeToday) {
    if (live) {
      // Partial AF bump mid-match — prefer desk + inMatch over double-count
      if (desk != null && af > desk && af < desk + inMatch) {
        return desk + inMatch;
      }
      return af + inMatch;
    }
  }
  // FT / finished: trust AF snapshot
  return af;
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


/** True when the desk match has kicked off (live or finished). Prematch = false. */
export function matchHasStarted(matchStatus?: string | null): boolean {
  const st = (matchStatus || "").trim();
  if (!st) return false;
  if (/^(assigned|scheduled|ns|not\s*started|tbd|postponed|cancelled|canceled|abandoned)$/i.test(st)) {
    return false;
  }
  return (
    st === "Live" ||
    st === "Half Time" ||
    st === "Full Time" ||
    /^(1H|2H|LIVE|HT|FT|AET|PEN|ET|BT|P)$/i.test(st)
  );
}

/**
 * Club season totals (all non-friendly comps) for the given team.
 * When teamAfId is set and AF has no rows for that club, returns zeros —
 * never falls back to another club / NT (Leão Milan 2025 → Galatasaray APP=30).
 */
export function aggregateClubSeasonTotals(
  statistics: AfTopScorer["statistics"] | undefined,
  teamAfId?: number | null
): { apps: number; goals: number; assists: number; rowCount: number } {
  return aggregateTeamSeasonTotals(statistics, teamAfId, {
    includeFriendlies: false,
  });
}

/** Aggregate goals/assists from an AF player statistics array for sync ingest. */
export function aggregateForIngest(
  statistics: AfTopScorer["statistics"] | undefined,
  leagueId: number,
  teamAfId?: number | null,
  opts?: { includeFriendlies?: boolean }
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

  const includeFriendlies = Boolean(opts?.includeFriendlies);
  let allGoals = 0;
  let allAssists = 0;
  let allApps = 0;
  for (const s of rows) {
    if (!includeFriendlies && isFriendlyCompetition(s.league?.name)) continue;
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

/**
 * Club European comps AF parks under country=World — never treat as international desks.
 */
const CLUB_WORLD_COMPETITION =
  /champions\s*league|europa\s*league|conference\s*league|uefa\s*super\s*cup|fifa\s*club\s*world|club\s*world\s*cup|libertadores|sudamericana|recopa|leagues\s*cup|campeones\s*cup|emirates\s*cup/i;

/**
 * Named international tournaments / NT competitions (Nations League, World Cup,
 * Euro, AFCON, Copa América, NT friendlies, etc.).
 */
const INTERNATIONAL_COMPETITION_NAME =
  /world\s*cup|uefa\s*nations|nations\s*league|africa\s*cup|afcon|\beuro\b|european\s*championship|copa\s*am[eé]rica|asian\s*cup|gold\s*cup|olympics|olympic\s*games|confederations|african\s*nations|concacaf\s*nations|arab\s*cup|nations?\s*cup|qualification/i;

/**
 * Detect an INTERNATIONAL desk / fixture from AF league (or MatchDay competition).
 * Club desks (domestic + UCL/UEL/etc.) stay false.
 *
 * Signals: named NT tournament; pure "Friendlies" (not "Friendlies Clubs");
 * AF country World/International only when the name is not a club-world comp.
 */
export function isInternationalCompetition(opts: {
  name?: string | null;
  country?: string | null;
  type?: string | null;
}): boolean {
  const name = (opts.name || "").trim();
  if (!name) return false;
  if (CLUB_WORLD_COMPETITION.test(name)) return false;
  if (/friendlies\s*clubs/i.test(name)) return false;
  if (INTERNATIONAL_COMPETITION_NAME.test(name)) return true;
  // AF id ~10: "Friendlies" between national teams
  if (/^friendl(?:y|ies)$/i.test(name)) return true;
  const country = (opts.country || "").trim().toLowerCase();
  if (
    (country === "world" || country === "international") &&
    !CLUB_WORLD_COMPETITION.test(name)
  ) {
    // World + Cup/League type with no club keywords — still require NT-ish name
    // cues so random World cups for clubs don't slip through.
    if (/nation|international|friendly|world\s*cup|\beuro\b|copa|afcon|gold\s*cup|asian/i.test(name)) {
      return true;
    }
  }
  return false;
}

/** Club-sounding tokens — used to avoid treating "Manchester United" as a country. */
export function looksLikeClubTeamName(teamName?: string | null): boolean {
  return /\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough|sporting|racing|dynamo|lokomotiv)\b/i.test(
    teamName || ""
  );
}

/**
 * Club season totals with optional friendlies.
 * Default (includeFriendlies=false) preserves club-desk behaviour.
 */
export function aggregateTeamSeasonTotals(
  statistics: AfTopScorer["statistics"] | undefined,
  teamAfId?: number | null,
  opts?: { includeFriendlies?: boolean }
): { apps: number; goals: number; assists: number; rowCount: number } {
  const rows = clubRows(statistics, teamAfId);
  const includeFriendlies = Boolean(opts?.includeFriendlies);
  let apps = 0;
  let goals = 0;
  let assists = 0;
  for (const s of rows) {
    if (!includeFriendlies && isFriendlyCompetition(s.league?.name)) continue;
    apps += s.games?.appearences ?? 0;
    goals += s.goals?.total ?? 0;
    assists += s.goals?.assists ?? 0;
  }
  return { apps, goals, assists, rowCount: rows.length };
}

/**
 * Sum career international caps / goals / assists across season blocks for one NT.
 * INCLUDES friendlies. Only counts rows for teamAfId (required).
 *
 * Live +1 contract (intl desks): Player.* stores career caps so far (this match
 * not yet counted). Prematch APP/CAPS = career; once LIVE and the player is on
 * for this international match, liveAdjustedSeasonStat bumps +1 — same spirit
 * as the locked club APP rule.
 */
export function aggregateInternationalCareerTotals(
  seasonBlocks: {
    statistics?: AfTopScorer["statistics"];
  }[],
  teamAfId: number
): { apps: number; goals: number; assists: number; seasons: number } {
  let apps = 0;
  let goals = 0;
  let assists = 0;
  let seasons = 0;
  for (const block of seasonBlocks) {
    const t = aggregateTeamSeasonTotals(block.statistics, teamAfId, {
      includeFriendlies: true,
    });
    if (t.rowCount <= 0) continue;
    apps += t.apps;
    goals += t.goals;
    assists += t.assists;
    seasons += 1;
  }
  return { apps, goals, assists, seasons };
}

/**
 * Whether a career stint (team) should include friendlies in totals.
 * True for national-team sides: team name maps like a country (and not a club
 * token), or any of its rows are international competitions.
 */
export function isNationalTeamCareerStint(
  teamName: string | null | undefined,
  rows: {
    league?: { name?: string | null; country?: string | null } | null;
  }[]
): boolean {
  const name = (teamName || "").trim();
  if (!name) return false;
  if (looksLikeClubTeamName(name)) return false;
  for (const r of rows) {
    if (
      isInternationalCompetition({
        name: r.league?.name,
        country: r.league?.country,
      })
    ) {
      return true;
    }
  }
  return false;
}
