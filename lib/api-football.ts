/**
 * API-Football (api-sports) client — server-side only.
 * Base: https://v3.football.api-sports.io
 * Auth header: x-apisports-key
 * Never call from the browser with the raw key; use /api/football/* proxies.
 */

import { getApiFootballKey } from "./env";
import { europeanSeasonYear, seasonCandidates } from "./season";

const BASE = "https://v3.football.api-sports.io";

export type AfFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null };
    venue?: { id: number | null; name: string | null; city: string | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    season: number;
    round?: string;
  };
  teams: {
    home: { id: number; name: string; logo?: string };
    away: { id: number; name: string; logo?: string };
  };
  goals: { home: number | null; away: number | null };
  score?: Record<string, unknown>;
};

export type AfLineupPlayer = {
  player: {
    id: number;
    name: string;
    number: number;
    pos?: string;
    grid?: string | null;
  };
};

export type AfLineup = {
  team: { id: number; name: string; logo?: string; colors?: unknown };
  formation: string | null;
  startXI: AfLineupPlayer[];
  substitutes: AfLineupPlayer[];
  coach?: { id: number; name: string; photo?: string };
};

export type AfEvent = {
  time: { elapsed: number | null; extra: number | null };
  team: { id: number; name: string; logo?: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  comments: string | null;
};

export type AfStatus = {
  account?: { firstname?: string; lastname?: string };
  subscription?: { plan?: string; end?: string; active?: boolean };
  requests?: {
    current?: number;
    limit_day?: number;
  };
};

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 30_000;
const RATE_LIMIT_TTL_MS = 60_000;

export class ApiFootballError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isApiFootballConfigured() {
  return Boolean(getApiFootballKey());
}

function formatApiErrors(errors: unknown): string {
  if (!errors) return "Unknown API-Football error";
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) {
    if (errors.length === 0) return "";
    return errors.map(String).join("; ");
  }
  if (typeof errors === "object") {
    const entries = Object.entries(errors as Record<string, unknown>);
    if (!entries.length) return "";
    return entries
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("; ");
  }
  return String(errors);
}

async function afFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const key = getApiFootballKey();
  if (!key) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY is not set. Add it to .env / .env.local and restart the Next.js server.",
      503,
      "missing_key"
    );
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
  const cacheKey = url;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data as T;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "x-apisports-key": key,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiFootballError(
      `API-Football network error: ${e instanceof Error ? e.message : String(e)}`,
      502,
      "network"
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiFootballError(
      "API-Football rejected the key (401/403). Check API_FOOTBALL_KEY and restart the server.",
      res.status,
      "unauthorized"
    );
  }

  if (res.status === 429) {
    throw new ApiFootballError(
      "API-Football rate limit hit (429). Wait a minute or upgrade your plan. Cached results may still appear.",
      429,
      "rate_limit"
    );
  }

  if (!res.ok) {
    throw new ApiFootballError(
      `API-Football HTTP ${res.status}`,
      res.status,
      "http"
    );
  }

  const json = (await res.json()) as {
    errors?: unknown;
    response?: T;
    results?: number;
  };

  const errText = formatApiErrors(json.errors);
  if (errText) {
    const lower = errText.toLowerCase();
    const planSeason =
      lower.includes("free plan") ||
      lower.includes("do not have access to this season") ||
      (lower.includes("season") && lower.includes("try from"));
    const rateLimited =
      !planSeason &&
      (lower.includes("rate") ||
        lower.includes("request limit") ||
        lower.includes("too many request"));
    const badKey =
      lower.includes("token") ||
      lower.includes("key") ||
      lower.includes("authoriz");
    if (planSeason) {
      throw new ApiFootballError(
        "API-Football Free plan cannot access this season (current seasons need Pro). " +
          "Search by date only works on Free; upgrade to Pro for league+season on 2025+. " +
          `Upstream: ${errText}`,
        200,
        "plan_season"
      );
    }
    throw new ApiFootballError(
      rateLimited
        ? `API-Football rate limit: ${errText}`
        : badKey
          ? `API-Football auth error: ${errText}`
          : `API-Football error: ${errText}`,
      rateLimited ? 429 : badKey ? 401 : 502,
      rateLimited ? "rate_limit" : badKey ? "unauthorized" : "api_error"
    );
  }

  // Most endpoints return arrays; /status returns a single object.
  const data = (
    json.response !== undefined && json.response !== null
      ? json.response
      : path === "/status"
        ? ({} as T)
        : ([] as unknown as T)
  ) as T;
  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function searchFixtures(opts: {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
  live?: string;
}) {
  return afFetch<AfFixture[]>("/fixtures", opts, 20_000);
}

export type SmartFixturesResult = {
  fixtures: AfFixture[];
  seasonUsed?: number;
  triedSeasons?: number[];
  strategy?: "date_only" | "date_filter_league" | "league_season" | "passthrough";
  planSeasonBlocked?: boolean;
  message?: string;
};

const FREE_PLAN_SEASON_MSG =
  "API-Football Free plan does not include current seasons (often capped ~2022–2024). " +
  "Date-only fixture search still works; league+season for 2025+ needs a Pro upgrade at api-football.com.";

/**
 * Prefer date-only /fixtures (works on Free). If a league is requested, filter
 * those results by league.id. Only fall back to league+season when needed;
 * Free-plan season errors become a soft message (never opaque 502).
 */
export async function searchFixturesSmart(opts: {
  date?: string;
  league?: number;
  season?: number;
  team?: number;
  id?: number;
}): Promise<SmartFixturesResult> {
  // id / team lookups — pass through
  if (opts.id || (opts.team && !opts.date && !opts.league)) {
    const fixtures = await searchFixtures(opts);
    return { fixtures, strategy: "passthrough" };
  }

  // Date path: never send season (Free plan friendly)
  if (opts.date) {
    const all = await searchFixtures({
      date: opts.date,
      team: opts.team,
    });

    if (!opts.league) {
      return { fixtures: all, strategy: "date_only" };
    }

    const filtered = all.filter((fx) => fx.league?.id === opts.league);
    if (filtered.length > 0) {
      return {
        fixtures: filtered,
        strategy: "date_filter_league",
        message:
          all.length !== filtered.length
            ? `Showing ${filtered.length} of ${all.length} fixtures for selected league (date-only search, Free-plan safe).`
            : undefined,
      };
    }

    // No league matches in date-only results — try league+season (may fail on Free)
    const candidates = opts.season
      ? [opts.season, opts.season - 1, opts.season + 1]
      : seasonCandidates(opts.date);
    const tried: number[] = [];
    let planBlocked = false;
    let lastError: ApiFootballError | null = null;

    for (const season of candidates) {
      if (tried.includes(season)) continue;
      tried.push(season);
      try {
        const fixtures = await searchFixtures({
          date: opts.date,
          league: opts.league,
          season,
          team: opts.team,
        });
        if (fixtures.length > 0) {
          return { fixtures, seasonUsed: season, triedSeasons: tried, strategy: "league_season" };
        }
      } catch (e) {
        if (e instanceof ApiFootballError) {
          if (e.code === "plan_season") {
            planBlocked = true;
            lastError = e;
            continue;
          }
          if (e.code === "unauthorized" || e.code === "rate_limit" || e.code === "missing_key") {
            throw e;
          }
          lastError = e;
          continue;
        }
        throw e;
      }
    }

    if (planBlocked) {
      return {
        fixtures: [],
        triedSeasons: tried,
        strategy: "league_season",
        planSeasonBlocked: true,
        message:
          FREE_PLAN_SEASON_MSG +
          ` No ${opts.league} matches on ${opts.date} in the date-wide feed either.`,
      };
    }

    if (lastError && lastError.code !== "plan_season") throw lastError;

    return {
      fixtures: [],
      seasonUsed: candidates[0],
      triedSeasons: tried,
      strategy: "date_filter_league",
      message: `No fixtures for league ${opts.league} on ${opts.date} (searched date-wide then seasons ${tried.join(",")}).`,
    };
  }

  // League without date: try seasons carefully
  if (opts.league) {
    const candidates = opts.season
      ? [opts.season, opts.season - 1, opts.season + 1]
      : [europeanSeasonYear(new Date()), ...seasonCandidates(new Date())];
    const tried: number[] = [];
    let planBlocked = false;
    let lastError: ApiFootballError | null = null;

    for (const season of candidates) {
      if (tried.includes(season)) continue;
      tried.push(season);
      try {
        const fixtures = await searchFixtures({
          league: opts.league,
          season,
          team: opts.team,
        });
        if (fixtures.length > 0) {
          return { fixtures, seasonUsed: season, triedSeasons: tried, strategy: "league_season" };
        }
      } catch (e) {
        if (e instanceof ApiFootballError) {
          if (e.code === "plan_season") {
            planBlocked = true;
            lastError = e;
            continue;
          }
          if (e.code === "unauthorized" || e.code === "rate_limit" || e.code === "missing_key") {
            throw e;
          }
          lastError = e;
          continue;
        }
        throw e;
      }
    }

    if (planBlocked) {
      return {
        fixtures: [],
        triedSeasons: tried,
        strategy: "league_season",
        planSeasonBlocked: true,
        message: FREE_PLAN_SEASON_MSG,
      };
    }
    if (lastError) throw lastError;
    return { fixtures: [], seasonUsed: candidates[0], triedSeasons: tried, strategy: "league_season" };
  }

  const fixtures = await searchFixtures(opts);
  return { fixtures, strategy: "passthrough" };
}

export async function getFixture(id: number) {
  const list = await afFetch<AfFixture[]>("/fixtures", { id }, 15_000);
  return list[0] || null;
}

export async function getLineups(fixtureId: number) {
  return afFetch<AfLineup[]>("/fixtures/lineups", { fixture: fixtureId }, 25_000);
}

export async function getEvents(fixtureId: number) {
  return afFetch<AfEvent[]>("/fixtures/events", { fixture: fixtureId }, 12_000);
}

export async function searchTeams(search: string) {
  return afFetch<
    { team: { id: number; name: string; code?: string; country?: string; logo?: string } }[]
  >("/teams", { search }, 60_000);
}

export async function searchLeagues(search: string) {
  return afFetch<
    {
      league: { id: number; name: string; type: string; logo?: string };
      country: { name: string };
    }[]
  >("/leagues", { search }, 120_000);
}

/** Lightweight connectivity check — hits /status without exposing the key. */
export async function getApiStatus() {
  return afFetch<AfStatus>("/status", {}, RATE_LIMIT_TTL_MS);
}

/** Map API-Football grid "row:col" (1-based from attack) into our formation slot ids loosely. */
export function gridToSlot(grid: string | null | undefined, index: number): string {
  if (!grid) {
    const fallback = ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"];
    return fallback[index] || `S${index + 1}`;
  }
  const [rowStr, colStr] = grid.split(":");
  const row = Number(rowStr);
  const col = Number(colStr);
  if (row === 1) return "GK";
  if (row === 2) {
    if (col <= 1) return "LB";
    if (col === 2) return "LCB";
    if (col === 3) return "RCB";
    return "RB";
  }
  if (row === 3) {
    if (col <= 1) return "LCM";
    if (col === 2) return "CM";
    return "RCM";
  }
  if (row === 4) {
    if (col <= 1) return "LW";
    if (col === 2) return "ST";
    return "RW";
  }
  if (col <= 1) return "LW";
  if (col === 2) return "ST";
  return "RW";
}

export function mapAfStatus(short: string): string {
  switch (short) {
    case "1H":
    case "2H":
    case "ET":
    case "BT":
    case "P":
    case "LIVE":
    case "HT":
      return "Live";
    case "FT":
    case "AET":
    case "PEN":
      return "Full Time";
    case "NS":
    case "TBD":
      return "Assigned";
    default:
      return "Assigned";
  }
}

/* ── Squads / injuries / predictions / last XI ─────────────────────────── */

export type AfSquadPlayer = {
  id: number;
  name: string;
  age?: number | null;
  number?: number | null;
  position?: string | null;
  photo?: string | null;
};

export type AfSquadResponse = {
  team: { id: number; name: string; logo?: string };
  players: AfSquadPlayer[];
};

export type AfInjury = {
  player: {
    id: number;
    name: string;
    photo?: string;
    type?: string;
    reason?: string;
  };
  team: { id: number; name: string; logo?: string };
  fixture?: { id: number; timezone?: string; date?: string };
  league?: { id: number; season: number; name: string };
};

export type AfPrediction = {
  predictions: {
    winner?: { id: number | null; name: string | null; comment?: string | null };
    win_or_draw?: boolean;
    under_over?: string | null;
    goals?: { home?: string | null; away?: string | null };
    advice?: string | null;
    percent?: { home?: string; draw?: string; away?: string };
  };
  league?: { id: number; name: string; country: string; season: number };
  teams?: {
    home?: { id: number; name: string; last_5?: unknown; league?: unknown };
    away?: { id: number; name: string; last_5?: unknown; league?: unknown };
  };
  comparison?: Record<string, { home?: string; away?: string }>;
  h2h?: AfFixture[];
};

export async function getSquads(teamId: number) {
  return afFetch<AfSquadResponse[]>("/players/squads", { team: teamId }, 300_000);
}

export async function getInjuriesByFixture(fixtureId: number) {
  return afFetch<AfInjury[]>("/injuries", { fixture: fixtureId }, 120_000);
}

export async function getPredictions(fixtureId: number) {
  return afFetch<AfPrediction[]>("/predictions", { fixture: fixtureId }, 300_000);
}

/** Most recent finished fixtures for a team (newest first). */
export async function getTeamRecentFinished(teamId: number, last = 8) {
  return afFetch<AfFixture[]>(
    "/fixtures",
    { team: teamId, last, status: "FT-AET-PEN" },
    120_000
  );
}

/**
 * Find the most recent finished fixture that has lineups for this team.
 * Returns that team's AfLineup, or null.
 */
export async function getLastPlayedLineup(teamId: number): Promise<{
  fixtureId: number;
  lineup: AfLineup;
} | null> {
  const recent = await getTeamRecentFinished(teamId, 10);
  for (const fx of recent) {
    try {
      const lineups = await getLineups(fx.fixture.id);
      const mine = lineups.find((l) => l.team.id === teamId);
      if (mine && mine.startXI?.length) {
        return { fixtureId: fx.fixture.id, lineup: mine };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function summarizeH2h(
  fixtures: AfFixture[] | undefined,
  homeAfId: number,
  awayAfId: number
): string {
  if (!fixtures?.length) return "No recent H2H in feed.";
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  const sample = fixtures.slice(0, 10);
  for (const fx of sample) {
    const hg = fx.goals?.home;
    const ag = fx.goals?.away;
    if (hg == null || ag == null) continue;
    const scoreFor = (teamId: number) => {
      if (fx.teams.home.id === teamId) return hg;
      if (fx.teams.away.id === teamId) return ag;
      return null;
    };
    const hs = scoreFor(homeAfId);
    const as_ = scoreFor(awayAfId);
    if (hs == null || as_ == null) continue;
    if (hs > as_) homeWins++;
    else if (as_ > hs) awayWins++;
    else draws++;
  }
  return `Last ${sample.length} H2H: ${homeWins}–${draws}–${awayWins} (W–D–L for home side).`;
}

export function parsePercent(p?: string | null): number | null {
  if (!p) return null;
  const n = Number(String(p).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}
