/**
 * Free advanced match stats (xG) — Understat primary.
 *
 * Coverage map (Understat):
 *   ✅ Premier League (EPL)
 *   ✅ La Liga
 *   ✅ Serie A
 *   ✅ Bundesliga
 *   ✅ Ligue 1
 *   ✅ Russian Premier League (RFPL) — available but rarely used here
 *   ❌ Süper Lig (Turkey) — not on Understat
 *   ❌ Scottish Premiership — not on Understat
 *   ❌ UEFA CL / EL / ECL — not on Understat match feed
 *
 * AF Pro /fixtures/statistics does NOT return expected_goals for our plan
 * (verified on Ligue 1 / Scottish Prem / Süper Lig fixtures) — do not invent.
 *
 * FotMob public JSON endpoints return 404 (removed); Big Balls needs an API key
 * (skipped — no new .env). Fail soft when scrape/API fails.
 */

import { europeanSeasonYear } from "./season";
import {
  fetchUnderstatLeague,
  fetchUnderstatMatch,
  type UnderstatDateRow,
  type UnderstatLeagueSlug,
  type UnderstatShot,
} from "./understat";

export type AdvancedStatsSource = "Understat";

export type AdvancedStatsCoverageEntry = {
  competition: string;
  covered: boolean;
  understatSlug?: UnderstatLeagueSlug;
  note?: string;
};

/** UI + code coverage map — which competitions get free xG. */
export const ADVANCED_STATS_COVERAGE: AdvancedStatsCoverageEntry[] = [
  { competition: "Premier League", covered: true, understatSlug: "EPL" },
  { competition: "La Liga", covered: true, understatSlug: "La_liga" },
  { competition: "Serie A", covered: true, understatSlug: "Serie_A" },
  { competition: "Bundesliga", covered: true, understatSlug: "Bundesliga" },
  { competition: "Ligue 1", covered: true, understatSlug: "Ligue_1" },
  {
    competition: "Russian Premier League",
    covered: true,
    understatSlug: "RFPL",
    note: "Supported by Understat; rarely used on Pitchline desks",
  },
  {
    competition: "Süper Lig",
    covered: false,
    note: "Understat has no Turkey coverage",
  },
  {
    competition: "Scottish Premiership",
    covered: false,
    note: "Understat has no Scotland coverage",
  },
  {
    competition: "UEFA Champions League",
    covered: false,
    note: "Understat does not publish UCL match xG in league feed",
  },
  {
    competition: "UEFA Europa League",
    covered: false,
  },
  {
    competition: "UEFA Europa Conference League",
    covered: false,
  },
];

const COMPETITION_TO_SLUG: Record<string, UnderstatLeagueSlug> = {
  "premier league": "EPL",
  epl: "EPL",
  "la liga": "La_liga",
  laliga: "La_liga",
  "serie a": "Serie_A",
  bundesliga: "Bundesliga",
  "ligue 1": "Ligue_1",
  "russian premier league": "RFPL",
  rfpl: "RFPL",
};

export type ShotSummary = {
  homeShots: number;
  awayShots: number;
  homeOnTarget: number;
  awayOnTarget: number;
  homeBlocked: number;
  awayBlocked: number;
};

export type AdvancedMatchStats = {
  available: boolean;
  source: AdvancedStatsSource | null;
  /** Short provenance label for UI, e.g. "xG · Understat" */
  sourceLabel: string;
  competition: string;
  coveredCompetition: boolean;
  message: string | null;
  homeXg: number | null;
  awayXg: number | null;
  /** Opponent xG faced ≈ away xG / home xG swapped — shown as xGA when we have both. */
  homeXga: number | null;
  awayXga: number | null;
  understatMatchId: string | null;
  matchedAt: string | null;
  forecast: { homeWin: number; draw: number; awayWin: number } | null;
  shotSummary: ShotSummary | null;
  coverage: AdvancedStatsCoverageEntry[];
};

type CacheEntry = { at: number; data: AdvancedMatchStats };
const resultCache = new Map<string, CacheEntry>();

type LeagueCacheEntry = { at: number; dates: UnderstatDateRow[] };
const leagueCache = new Map<string, LeagueCacheEntry>();

const LIVE_TTL_MS = 90_000; // ~1.5 min for in-play / recent
const FINISHED_TTL_MS = 30 * 60_000; // 30 min for finished
const UNAVAILABLE_TTL_MS = 10 * 60_000;
const LEAGUE_TTL_MS = 5 * 60_000;

function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(
      /\b(fc|cf|afc|sc|ac|as|ss|calcio|club|de|the|fk|sk|if|bk)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES: Record<string, string> = {
  "paris saint germain": "psg",
  "paris sg": "psg",
  "olympique lyonnais": "lyon",
  "olympique lyon": "lyon",
  "olympique de marseille": "marseille",
  "olympique marseille": "marseille",
  "manchester united": "man united",
  "manchester city": "man city",
  "tottenham hotspur": "tottenham",
  "wolverhampton wanderers": "wolves",
  "brighton and hove albion": "brighton",
  "nottingham forest": "nott forest",
  "atletico madrid": "atletico",
  "athletic club": "athletic bilbao",
  "athletic bilbao": "athletic bilbao",
  "inter milan": "inter",
  "internazionale": "inter",
  "bayern munich": "bayern",
  "bayern munchen": "bayern",
  "borussia dortmund": "dortmund",
  "borussia monchengladbach": "gladbach",
  "rb leipzig": "leipzig",
  "eintracht frankfurt": "frankfurt",
};

function canonicalName(raw: string): string {
  const n = normalizeName(raw);
  return ALIASES[n] || n;
}

function namesMatch(a: string, b: string): boolean {
  const ca = canonicalName(a);
  const cb = canonicalName(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.includes(cb) || cb.includes(ca)) return true;
  // token overlap (e.g. "Saint Etienne" vs "AS Saint-Etienne")
  const ta = new Set(ca.split(" ").filter((t) => t.length > 2));
  const tb = new Set(cb.split(" ").filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return false;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit >= Math.min(2, Math.min(ta.size, tb.size));
}

function parseXg(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function understatSlugForCompetition(
  competition: string
): UnderstatLeagueSlug | null {
  const key = competition.trim().toLowerCase();
  if (COMPETITION_TO_SLUG[key]) return COMPETITION_TO_SLUG[key];
  // partial
  for (const [name, slug] of Object.entries(COMPETITION_TO_SLUG)) {
    if (key.includes(name) || name.includes(key)) return slug;
  }
  const entry = ADVANCED_STATS_COVERAGE.find(
    (c) => c.competition.toLowerCase() === key
  );
  return entry?.understatSlug ?? null;
}

function emptyResult(
  competition: string,
  covered: boolean,
  message: string
): AdvancedMatchStats {
  return {
    available: false,
    source: null,
    sourceLabel: "xG",
    competition,
    coveredCompetition: covered,
    message,
    homeXg: null,
    awayXg: null,
    homeXga: null,
    awayXga: null,
    understatMatchId: null,
    matchedAt: null,
    forecast: null,
    shotSummary: null,
    coverage: ADVANCED_STATS_COVERAGE,
  };
}

function summarizeShots(
  home: UnderstatShot[] | undefined,
  away: UnderstatShot[] | undefined
): ShotSummary {
  const tally = (shots: UnderstatShot[] | undefined) => {
    const list = shots || [];
    let onTarget = 0;
    let blocked = 0;
    for (const s of list) {
      const r = (s.result || "").toLowerCase();
      if (r === "goal" || r === "savedshot" || r === "shotontarget") onTarget++;
      if (r === "blockedshot") blocked++;
    }
    return { n: list.length, onTarget, blocked };
  };
  const h = tally(home);
  const a = tally(away);
  return {
    homeShots: h.n,
    awayShots: a.n,
    homeOnTarget: h.onTarget,
    awayOnTarget: a.onTarget,
    homeBlocked: h.blocked,
    awayBlocked: a.blocked,
  };
}

function pickMatch(
  dates: UnderstatDateRow[],
  homeName: string,
  awayName: string,
  kickoff: Date
): UnderstatDateRow | null {
  const kickMs = kickoff.getTime();
  const windowMs = 36 * 60 * 60 * 1000;
  let best: { row: UnderstatDateRow; score: number } | null = null;

  for (const row of dates) {
    if (!namesMatch(row.h?.title || "", homeName)) continue;
    if (!namesMatch(row.a?.title || "", awayName)) continue;
    const dt = Date.parse((row.datetime || "").replace(" ", "T") + "Z");
    if (!Number.isFinite(dt)) continue;
    const delta = Math.abs(dt - kickMs);
    if (delta > windowMs) continue;
    // prefer closer kickoff; slight boost if xG present
    const hasXg = row.xG?.h != null && row.xG?.a != null;
    const score = delta - (hasXg ? 60_000 : 0);
    if (!best || score < best.score) best = { row, score };
  }
  return best?.row ?? null;
}

async function loadLeagueDates(
  slug: UnderstatLeagueSlug,
  season: number
): Promise<UnderstatDateRow[]> {
  const key = `${slug}:${season}`;
  const hit = leagueCache.get(key);
  if (hit && Date.now() - hit.at < LEAGUE_TTL_MS) return hit.dates;
  const payload = await fetchUnderstatLeague(slug, season);
  leagueCache.set(key, { at: Date.now(), dates: payload.dates });
  return payload.dates;
}

export type ResolveAdvancedStatsInput = {
  matchId: string;
  competition: string;
  homeName: string;
  awayName: string;
  kickoff: Date | string;
  status?: string | null;
};

export async function resolveAdvancedMatchStats(
  input: ResolveAdvancedStatsInput
): Promise<AdvancedMatchStats> {
  const competition = input.competition || "";
  const kickoff =
    typeof input.kickoff === "string"
      ? new Date(input.kickoff)
      : input.kickoff;
  const status = input.status || "";
  const finished = /full\s*time|ft|finished|aet|pen/i.test(status);
  const ttl = finished ? FINISHED_TTL_MS : LIVE_TTL_MS;

  const cacheKey = `adv:${input.matchId}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < ttl) {
    return cached.data;
  }

  const slug = understatSlugForCompetition(competition);
  if (!slug) {
    const msg = `xG not available for this competition`;
    const data = emptyResult(competition, false, msg);
    resultCache.set(cacheKey, { at: Date.now(), data });
    // shorter negative cache still ok
    return data;
  }

  try {
    const season = europeanSeasonYear(kickoff);
    let dates = await loadLeagueDates(slug, season);
    let row = pickMatch(dates, input.homeName, input.awayName, kickoff);

    // Adjacent season fallback (early Aug / late May edge)
    if (!row) {
      for (const alt of [season - 1, season + 1]) {
        try {
          dates = await loadLeagueDates(slug, alt);
          row = pickMatch(dates, input.homeName, input.awayName, kickoff);
          if (row) break;
        } catch {
          /* soft */
        }
      }
    }

    if (!row) {
      const data = emptyResult(
        competition,
        true,
        "xG feed found for this competition, but this fixture could not be matched"
      );
      resultCache.set(cacheKey, {
        at: Date.now(),
        data,
      });
      return data;
    }

    const homeXg = parseXg(row.xG?.h);
    const awayXg = parseXg(row.xG?.a);

    if (homeXg == null || awayXg == null) {
      // Upcoming / not yet modelled — honest empty, still covered
      const data: AdvancedMatchStats = {
        ...emptyResult(
          competition,
          true,
          "xG not published yet for this fixture"
        ),
        source: "Understat",
        sourceLabel: "xG · Understat",
        understatMatchId: row.id,
        matchedAt: row.datetime,
      };
      resultCache.set(cacheKey, { at: Date.now(), data });
      return data;
    }

    let shotSummary: ShotSummary | null = null;
    try {
      const matchPayload = await fetchUnderstatMatch(row.id);
      shotSummary = summarizeShots(
        matchPayload.shots?.h,
        matchPayload.shots?.a
      );
    } catch {
      shotSummary = null;
    }

    let forecast: AdvancedMatchStats["forecast"] = null;
    if (row.forecast?.w != null) {
      const hw = Number(row.forecast.w);
      const d = Number(row.forecast.d);
      const aw = Number(row.forecast.l);
      if ([hw, d, aw].every(Number.isFinite)) {
        forecast = {
          homeWin: Math.round(hw * 1000) / 10,
          draw: Math.round(d * 1000) / 10,
          awayWin: Math.round(aw * 1000) / 10,
        };
      }
    }

    const data: AdvancedMatchStats = {
      available: true,
      source: "Understat",
      sourceLabel: "xG · Understat",
      competition,
      coveredCompetition: true,
      message: null,
      homeXg,
      awayXg,
      homeXga: awayXg,
      awayXga: homeXg,
      understatMatchId: row.id,
      matchedAt: row.datetime,
      forecast,
      shotSummary,
      coverage: ADVANCED_STATS_COVERAGE,
    };
    resultCache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch {
    const data = emptyResult(
      competition,
      true,
      "xG temporarily unavailable (source error)"
    );
    resultCache.set(cacheKey, {
      at: Date.now(),
      data,
    });
    // use unavailable TTL by overwriting at with older? Just use normal — soft fail.
    void UNAVAILABLE_TTL_MS;
    return data;
  }
}
