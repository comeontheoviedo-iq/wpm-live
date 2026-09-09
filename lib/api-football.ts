/**
 * API-Football (api-sports) client — server-side only.
 * Base: https://v3.football.api-sports.io
 * Auth header: x-apisports-key
 * Never call from the browser with the raw key; use /api/football/* proxies.
 */

import { getApiFootballKey } from "./env";
import { slotsFor } from "./formations";
import { europeanSeasonYear, seasonCandidates } from "./season";

const BASE = "https://v3.football.api-sports.io";

export type AfFixture = {
  fixture: {
    id: number;
    date: string;
    referee?: string | null;
    status: { short: string; long: string; elapsed: number | null; extra?: number | null };
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

/** Feed lineup strip colours (hex without #). */
export type AfKitSwatch = {
  primary?: string | null;
  number?: string | null;
  border?: string | null;
};

export type AfTeamColors = {
  player?: AfKitSwatch | null;
  goalkeeper?: AfKitSwatch | null;
};

export type AfLineup = {
  team: { id: number; name: string; logo?: string; colors?: AfTeamColors | null };
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
/** In-flight dedupe: concurrent identical AF GETs coalesce to one upstream call. */
const inflight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 30_000;
const RATE_LIMIT_TTL_MS = 60_000;
/** Live desk/overlay share window — fixture/events/stats. */
export const AF_LIVE_TTL_MS = 25_000;

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


/** True when fixture home/away AF team ids equal the expected pair (order-sensitive). */
export function fixtureTeamsMatch(
  fixture: AfFixture,
  homeAfId: number,
  awayAfId: number
): boolean {
  return (
    fixture.teams?.home?.id === homeAfId &&
    fixture.teams?.away?.id === awayAfId
  );
}

export type FixtureCompatibility = {
  ok: boolean;
  reason?: string;
};

/**
 * Guardrail: refuse linking/syncing a fixture that is not the desk's match.
 * When both club AF ids are known, both must appear on the fixture in the same
 * home/away order. When a league id is known, fixture.league.id must match
 * (blocks Super Liga Slovakia vs Süper Lig Turkey name collisions).
 */
export function assertFixtureCompatible(opts: {
  fixture: AfFixture;
  homeAfId?: number | null;
  awayAfId?: number | null;
  leagueId?: number | null;
}): FixtureCompatibility {
  const { fixture, homeAfId, awayAfId, leagueId } = opts;
  if (leagueId != null && fixture.league?.id !== leagueId) {
    return {
      ok: false,
      reason:
        `Fixture #${fixture.fixture.id} is ${fixture.league?.name || "?"} ` +
        `(${fixture.league?.country || "?"}, league ${fixture.league?.id}) — ` +
        `expected league id ${leagueId}.`,
    };
  }
  if (homeAfId != null && awayAfId != null) {
    if (!fixtureTeamsMatch(fixture, homeAfId, awayAfId)) {
      return {
        ok: false,
        reason:
          `Fixture #${fixture.fixture.id} is ${fixture.teams.home.name} vs ` +
          `${fixture.teams.away.name} (AF ${fixture.teams.home.id}/${fixture.teams.away.id}) — ` +
          `desk expects AF ${homeAfId} vs ${awayAfId}.`,
      };
    }
  } else if (homeAfId != null) {
    if (
      fixture.teams.home.id !== homeAfId &&
      fixture.teams.away.id !== homeAfId
    ) {
      return {
        ok: false,
        reason: `Fixture #${fixture.fixture.id} does not include home team AF ${homeAfId}.`,
      };
    }
  } else if (awayAfId != null) {
    if (
      fixture.teams.home.id !== awayAfId &&
      fixture.teams.away.id !== awayAfId
    ) {
      return {
        ok: false,
        reason: `Fixture #${fixture.fixture.id} does not include away team AF ${awayAfId}.`,
      };
    }
  }
  return { ok: true };
}


function formatApiErrors(errors: unknown): string {
  if (!errors) return "Unknown live-feed error";
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

  const pending = inflight.get(cacheKey);
  if (pending) return pending as Promise<T>;

  const run = (async (): Promise<T> => {
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
        `Live-feed network error: ${e instanceof Error ? e.message : String(e)}`,
        502,
        "network"
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new ApiFootballError(
        "Live feed rejected the key (401/403). Check the live-feed key and restart the server.",
        res.status,
        "unauthorized"
      );
    }

    if (res.status === 429) {
      throw new ApiFootballError(
        "Live-feed rate limit hit (429). Wait a minute or upgrade your plan. Cached results may still appear.",
        429,
        "rate_limit"
      );
    }

    if (!res.ok) {
      throw new ApiFootballError(
        `Live-feed HTTP ${res.status}`,
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
          "Live-feed free plan cannot access this season (current seasons need a higher plan). " +
            "Search by date only works on Free; upgrade to Pro for league+season on 2025+. " +
            `Upstream: ${errText}`,
          200,
          "plan_season"
        );
      }
      throw new ApiFootballError(
        rateLimited
          ? `Live-feed rate limit: ${errText}`
          : badKey
            ? `Live-feed auth error: ${errText}`
            : `Live-feed error: ${errText}`,
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
  })();

  inflight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    if (inflight.get(cacheKey) === run) inflight.delete(cacheKey);
  }
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
  "Live-feed free plan does not include current seasons (often capped ~2022–2024). " +
  "Date-only fixture search still works; league+season for 2025+ needs a higher live-feed plan.";

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
  /** When both set, keep only fixtures with this exact home/away pair. */
  homeTeam?: number;
  awayTeam?: number;
  id?: number;
}): Promise<SmartFixturesResult> {
  const applyTeamPair = (list: AfFixture[]) => {
    if (opts.homeTeam == null || opts.awayTeam == null) return list;
    return list.filter((fx) =>
      fixtureTeamsMatch(fx, opts.homeTeam!, opts.awayTeam!)
    );
  };
  const applyLeague = (list: AfFixture[]) => {
    if (opts.league == null) return list;
    return list.filter((fx) => fx.league?.id === opts.league);
  };

  // id / team lookups — pass through
  if (opts.id || (opts.team && !opts.date && !opts.league)) {
    const fixtures = applyTeamPair(applyLeague(await searchFixtures(opts)));
    return { fixtures, strategy: "passthrough" };
  }

  // Date path: never send season (Free plan friendly)
  if (opts.date) {
    const all = await searchFixtures({
      date: opts.date,
      team: opts.team,
    });

    const leagueFiltered = applyLeague(all);
    const filtered = applyTeamPair(leagueFiltered);
    if (!opts.league) {
      return { fixtures: filtered, strategy: "date_only" };
    }

    if (filtered.length > 0) {
      return {
        fixtures: filtered,
        strategy: "date_filter_league",
        message:
          all.length !== filtered.length
            ? `Showing ${filtered.length} of ${all.length} fixtures for selected league` +
              (opts.homeTeam && opts.awayTeam ? " + both teams" : "") +
              ` (date-only search, Free-plan safe).`
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
        const paired = applyTeamPair(fixtures);
        if (paired.length > 0) {
          return { fixtures: paired, seasonUsed: season, triedSeasons: tried, strategy: "league_season" };
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
        const paired = applyTeamPair(fixtures);
        if (paired.length > 0) {
          return { fixtures: paired, seasonUsed: season, triedSeasons: tried, strategy: "league_season" };
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
  const list = await afFetch<AfFixture[]>("/fixtures", { id }, AF_LIVE_TTL_MS);
  return list[0] || null;
}

export async function getLineups(fixtureId: number) {
  return afFetch<AfLineup[]>("/fixtures/lineups", { fixture: fixtureId }, 30_000);
}

export async function getEvents(fixtureId: number) {
  return afFetch<AfEvent[]>("/fixtures/events", { fixture: fixtureId }, AF_LIVE_TTL_MS);
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

/** Group formation slots into horizontal lines by similar y (GK → attack). */
function slotLines(formation?: string | null) {
  const slots = [...slotsFor(formation || "4-3-3")].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: typeof slots[] = [];
  for (const s of slots) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - s.y) <= 8) last.push(s);
    else lines.push([s]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return { slots: slotsFor(formation || "4-3-3"), lines, ordered: lines.flat() };
}

/**
 * Robust AF startXI → formation slot assignment.
 * Sort players by grid row/col (row 1 = defensive), map onto formation lines
 * sorted by y desc / x asc. Forces GK when pos=G or lone row-1 player.
 * Never uses naive nearest (tx=col*18) for row 1.
 */
export function assignSlotsFromStartXI(
  startXI: AfLineupPlayer[],
  formation?: string | null
): string[] {
  const { slots, lines, ordered } = slotLines(formation);
  const n = startXI.length;
  const result = new Array<string>(n).fill("");

  const parsed = startXI.map((row, index) => {
    const grid = row.player.grid || "";
    const [rs, cs] = String(grid).split(":");
    const rowNum = Number(rs);
    const colNum = Number(cs);
    const pos = String(row.player.pos || "").toUpperCase();
    return {
      index,
      pos,
      row: Number.isFinite(rowNum) ? rowNum : 999,
      col: Number.isFinite(colNum) ? colNum : index + 1,
      hasGrid: Boolean(grid && Number.isFinite(rowNum)),
    };
  });

  // Prefer line-aware mapping when player rows ≈ formation lines
  const byRow = new Map<number, typeof parsed>();
  for (const p of parsed) {
    const list = byRow.get(p.row) || [];
    list.push(p);
    byRow.set(p.row, list);
  }
  const playerRows = [...byRow.keys()].filter((r) => r < 900).sort((a, b) => a - b);

  let mapped = false;
  if (playerRows.length && playerRows.length === lines.length && n === ordered.length) {
    mapped = true;
    for (let li = 0; li < lines.length; li++) {
      const rowPlayers = (byRow.get(playerRows[li]) || []).sort((a, b) => a.col - b.col);
      const lineSlots = lines[li];
      const count = Math.min(rowPlayers.length, lineSlots.length);
      for (let i = 0; i < count; i++) {
        result[rowPlayers[i].index] = lineSlots[i].id;
      }
      // Overflow on this row → leftover slots on same line then global leftovers
      if (rowPlayers.length > lineSlots.length) {
        const leftoverSlots = ordered.filter((s) => !result.includes(s.id));
        for (let i = lineSlots.length; i < rowPlayers.length; i++) {
          const slot = leftoverSlots.shift();
          if (slot) result[rowPlayers[i].index] = slot.id;
        }
      }
    }
  }

  if (!mapped && n === ordered.length) {
    const sorted = [...parsed].sort((a, b) => a.row - b.row || a.col - b.col);
    for (let i = 0; i < sorted.length; i++) {
      result[sorted[i].index] = ordered[i].id;
    }
    mapped = true;
  }

  if (!mapped) {
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      result[i] = gridToSlot(startXI[i]?.player.grid, i, formation, used);
    }
  }

  // Fill any holes
  const used = new Set(result.filter(Boolean));
  for (let i = 0; i < n; i++) {
    if (result[i]) continue;
    const next = ordered.find((s) => !used.has(s.id)) || slots[i];
    if (next) {
      result[i] = next.id;
      used.add(next.id);
    } else {
      result[i] = `S${i + 1}`;
    }
  }

  // Force GK slot for goalkeeper
  const gkSlot = slots.find((s) => s.id === "GK")?.id || ordered[0]?.id;
  if (gkSlot) {
    const gkCandidates = parsed.filter(
      (p) => p.pos === "G" || p.pos.startsWith("G")
    );
    const row1 = parsed.filter((p) => p.row === 1);
    let gkIdx: number | null = null;
    if (gkCandidates.length === 1) gkIdx = gkCandidates[0].index;
    else if (row1.length === 1) gkIdx = row1[0].index;
    else if (gkCandidates.length) {
      gkIdx =
        gkCandidates.find((g) => g.row === 1)?.index ?? gkCandidates[0].index;
    }
    if (gkIdx != null && result[gkIdx] !== gkSlot) {
      const holder = result.findIndex((s) => s === gkSlot);
      const prev = result[gkIdx];
      result[gkIdx] = gkSlot;
      if (holder >= 0 && holder !== gkIdx) result[holder] = prev;
    }
  }

  return result;
}

/** Remap existing starters onto a new formation by position band + lateral x. */
export function remapStartersToFormation(
  starters: { id: string; formationSlot: string | null; position?: string | null }[],
  newFormation: string
): { playerId: string; formationSlot: string }[] {
  const { ordered, lines } = slotLines(newFormation);

  const coordFor = (slotId: string | null) => {
    if (!slotId) return { y: 50, x: 50 };
    for (const f of ["4-3-3", "4-2-3-1", "4-4-2", "4-2-2-2", "3-5-2"]) {
      const s = slotsFor(f).find((x) => x.id === slotId);
      if (s) return { y: s.y, x: s.x };
    }
    return { y: 50, x: 50 };
  };

  const posBand = (pos?: string | null, slotId?: string | null) => {
    const p = String(pos || "").toUpperCase();
    if (p.startsWith("G") || slotId === "GK") return 0;
    if (p.startsWith("D")) return 1;
    if (p.startsWith("M")) return 2;
    if (p.startsWith("F") || p.startsWith("A")) return 3;
    // Infer from old slot y if position missing
    const y = coordFor(slotId || null).y;
    if (y >= 85) return 0;
    if (y >= 65) return 1;
    if (y >= 40) return 2;
    return 3;
  };

  // Bucket players into GK / DEF / MID / FWD by position (fallback slot y)
  const buckets: typeof starters[] = [[], [], [], []];
  for (const s of starters) {
    const b = Math.min(3, Math.max(0, posBand(s.position, s.formationSlot)));
    buckets[b].push(s);
  }
  for (const b of buckets) {
    b.sort((a, c) => coordFor(a.formationSlot).x - coordFor(c.formationSlot).x);
  }

  // Prefer filling formation lines: line0=GK, then remaining lines left→right
  const out: { playerId: string; formationSlot: string }[] = [];
  const used = new Set<string>();

  const takeFromBands = (bands: number[], count: number) => {
    const picked: typeof starters = [];
    for (const band of bands) {
      while (picked.length < count && buckets[band].length) {
        const p = buckets[band].shift()!;
        if (used.has(p.id)) continue;
        used.add(p.id);
        picked.push(p);
      }
    }
    // spill from any remaining
    for (const band of [0, 1, 2, 3]) {
      while (picked.length < count && buckets[band].length) {
        const p = buckets[band].shift()!;
        if (used.has(p.id)) continue;
        used.add(p.id);
        picked.push(p);
      }
    }
    return picked;
  };

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const bands =
      li === 0 ? [0] : li === 1 ? [1] : li >= lines.length - 1 ? [3, 2] : [2, 1, 3];
    const players = takeFromBands(bands, line.length);
    players.sort((a, c) => coordFor(a.formationSlot).x - coordFor(c.formationSlot).x);
    for (let i = 0; i < line.length; i++) {
      const p = players[i];
      if (!p) break;
      out.push({ playerId: p.id, formationSlot: line[i].id });
    }
  }

  // Anyone left
  const leftover = starters.filter((s) => !used.has(s.id));
  const freeSlots = ordered.filter((s) => !out.some((o) => o.formationSlot === s.id));
  for (let i = 0; i < leftover.length; i++) {
    out.push({
      playerId: leftover[i].id,
      formationSlot: freeSlots[i]?.id || ordered[ordered.length - 1]?.id || "CM",
    });
  }

  return out;
}

/** Map API-Football grid "row:col" into formation slot ids (legacy / overflow). */
export function gridToSlot(
  grid: string | null | undefined,
  index: number,
  formation?: string | null,
  used?: Set<string>
): string {
  const { slots, ordered } = slotLines(formation);
  const taken = used ?? new Set<string>();

  const pickUnused = (preferredId?: string | null): string => {
    if (preferredId && !taken.has(preferredId) && slots.some((s) => s.id === preferredId)) {
      taken.add(preferredId);
      return preferredId;
    }
    const byIndex = ordered[index] || slots[index];
    if (byIndex && !taken.has(byIndex.id)) {
      taken.add(byIndex.id);
      return byIndex.id;
    }
    const first = ordered.find((s) => !taken.has(s.id)) || slots.find((s) => !taken.has(s.id));
    if (first) {
      taken.add(first.id);
      return first.id;
    }
    const fallback = slots[slots.length - 1]?.id || `S${index + 1}`;
    taken.add(fallback);
    return fallback;
  };

  if (!grid) return pickUnused(null);

  const [rowStr, colStr] = grid.split(":");
  const row = Number(rowStr);
  const col = Number(colStr);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return pickUnused(null);

  // Row 1 is always GK when available — never nearest(tx=col*18)
  if (row === 1) {
    return pickUnused("GK");
  }

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const ty = clamp(100 - (row - 1) * 20, 12, 90);
  const tx = clamp(col * 18, 12, 88);

  let bestId: string | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    if (taken.has(slot.id) || slot.id === "GK") continue;
    const dist = (slot.x - tx) ** 2 + (slot.y - ty) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestId = slot.id;
    }
  }
  return pickUnused(bestId);
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

/**
 * Most recent lineup strip colours for a team (AF often omits colours on
 * cup / early fixtures). Prefer same venue role when possible.
 */
export async function getLastKnownTeamColors(
  teamId: number,
  opts?: { preferHome?: boolean; last?: number; avoidPrimary?: string | null }
): Promise<AfTeamColors | null> {
  const preferHome = opts?.preferHome;
  const avoid = (opts?.avoidPrimary || "").replace(/^#/, "").toLowerCase();
  const recent = await getTeamRecentFinished(teamId, opts?.last ?? 10);
  const ordered =
    preferHome == null
      ? recent
      : [
          ...recent.filter((fx) =>
            preferHome
              ? fx.teams.home.id === teamId
              : fx.teams.away.id === teamId
          ),
          ...recent.filter((fx) =>
            preferHome
              ? fx.teams.home.id !== teamId
              : fx.teams.away.id !== teamId
          ),
        ];
  let fallback: AfTeamColors | null = null;
  for (const fx of ordered) {
    try {
      const lineups = await getLineups(fx.fixture.id);
      const mine = lineups.find((l) => l.team.id === teamId);
      const colors = mine?.team?.colors;
      if (
        colors &&
        typeof colors === "object" &&
        (colors.player?.primary || colors.goalkeeper?.primary)
      ) {
        const primary = String(colors.player?.primary || "")
          .replace(/^#/, "")
          .toLowerCase();
        if (avoid && primary === avoid) {
          if (!fallback) fallback = colors;
          continue;
        }
        return colors;
      }
    } catch {
      continue;
    }
  }
  return fallback;
}

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


/* ── Statistics / scorers / venues / player stats ───────────────────────── */

export type AfStatisticRow = {
  type: string;
  value: number | string | null;
};

export type AfFixtureStatistics = {
  team: { id: number; name: string; logo?: string };
  statistics: AfStatisticRow[];
};

export async function getStatistics(fixtureId: number) {
  return afFetch<AfFixtureStatistics[]>(
    "/fixtures/statistics",
    { fixture: fixtureId },
    AF_LIVE_TTL_MS
  );
}

export type AfTopScorer = {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    nationality?: string;
    height?: string;
    weight?: string;
    photo?: string;
    /** Present on some AF plans / players; often absent. */
    foot?: string | null;
    birth?: { date?: string | null; place?: string | null; country?: string | null };
  };
  statistics: {
    team: { id: number; name: string; logo?: string };
    league?: { id: number; name: string; country: string; season: number };
    games?: { appearences?: number | null; lineups?: number | null; minutes?: number | null; position?: string | null; rating?: string | number | null };
    goals?: { total?: number | null; assists?: number | null; conceded?: number | null; saves?: number | null };
    cards?: { yellow?: number | null; red?: number | null };
  }[];
};

export async function getTopScorers(leagueId: number, season: number) {
  return afFetch<AfTopScorer[]>(
    "/players/topscorers",
    { league: leagueId, season },
    300_000
  );
}

export type AfVenueDetail = {
  id: number;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  capacity?: number | null;
  surface?: string | null;
  image?: string | null;
};

export async function getVenueById(venueId: number) {
  const list = await afFetch<AfVenueDetail[]>("/venues", { id: venueId }, 300_000);
  return list[0] || null;
}

export type AfTeamRow = {
  team: { id: number; name: string; code?: string | null; country?: string; founded?: number | null; national?: boolean; logo?: string };
  venue?: AfVenueDetail | null;
};

export async function getTeam(teamId: number) {
  const list = await afFetch<AfTeamRow[]>("/teams", { id: teamId }, 300_000);
  return list[0] || null;
}

export async function getPlayerById(playerId: number, season?: number) {
  const params: Record<string, string | number | undefined> = { id: playerId };
  if (season) params.season = season;
  return afFetch<AfTopScorer[]>("/players", params, 120_000);
}

/** Team season player stats (paginated; page 1 is usually enough for XI depth). */
export async function getPlayersByTeam(
  teamId: number,
  season: number,
  page = 1
) {
  return afFetch<AfTopScorer[]>(
    "/players",
    { team: teamId, season, page },
    300_000
  );
}

export type AfCoachCareer = {
  team?: { id?: number | null; name?: string; logo?: string } | null;
  start?: string | null;
  end?: string | null;
};

export type AfCoach = {
  id: number;
  name: string;
  firstname?: string | null;
  lastname?: string | null;
  age?: number | null;
  nationality?: string | null;
  photo?: string | null;
  birth?: { date?: string | null; place?: string | null; country?: string | null };
  team?: { id?: number | null; name?: string; logo?: string } | null;
  career?: AfCoachCareer[];
};

/** API path is `/coachs` (API-Football spelling). */
export async function getCoachById(coachId: number) {
  const list = await afFetch<AfCoach[]>("/coachs", { id: coachId }, 300_000);
  return list[0] || null;
}

function coachCareerOpen(end?: string | null) {
  return end == null || end === "" || end === "null";
}

/**
 * AF /coachs?team= returns historical + current staff, often all with team.id set.
 * Prefer the open career stint at this team with the latest start date (current HC).
 */
export async function getCoachByTeam(teamId: number) {
  const list = await afFetch<AfCoach[]>("/coachs", { team: teamId }, 300_000);
  if (!list.length) return null;

  const ranked = list.map((c) => {
    const stints = (c.career || []).filter((x) => x.team?.id === teamId);
    const open = stints
      .filter((x) => coachCareerOpen(x.end))
      .sort((a, b) => String(b.start || "").localeCompare(String(a.start || "")));
    const any = [...stints].sort((a, b) =>
      String(b.start || "").localeCompare(String(a.start || ""))
    );
    return {
      coach: c,
      openStart: open[0]?.start || null,
      anyStart: any[0]?.start || null,
      teamMatch: c.team?.id === teamId,
    };
  });

  ranked.sort((a, b) => {
    if (a.openStart && !b.openStart) return -1;
    if (!a.openStart && b.openStart) return 1;
    if (a.openStart && b.openStart) return b.openStart.localeCompare(a.openStart);
    if (a.teamMatch !== b.teamMatch) return a.teamMatch ? -1 : 1;
    return String(b.anyStart || "").localeCompare(String(a.anyStart || ""));
  });

  return ranked[0]?.coach || list[0];
}

export type AfPlayerTeam = {
  team: { id: number; name: string; logo?: string };
  seasons: number[];
};

/** Clubs the player has appeared for (AF /players/teams). */
export async function getPlayerTeams(playerId: number) {
  return afFetch<AfPlayerTeam[]>("/players/teams", { player: playerId }, 300_000);
}

export async function searchCoaches(search: string) {
  return afFetch<AfCoach[]>("/coachs", { search }, 120_000);
}

/* ── League / competition intel (standings, form, upcoming, live) ───────── */

export type AfStandingTeam = {
  rank: number;
  team: { id: number; name: string; logo?: string };
  points: number;
  goalsDiff: number;
  group?: string;
  form?: string | null;
  status?: string | null;
  description?: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  home?: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
  away?: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
};

export type AfStandingsLeague = {
  league: {
    id: number;
    name: string;
    country: string;
    logo?: string;
    flag?: string;
    season: number;
    standings: AfStandingTeam[][];
  };
};

export async function getStandings(leagueId: number, season: number) {
  return afFetch<AfStandingsLeague[]>(
    "/standings",
    { league: leagueId, season },
    120_000
  );
}

/** Fixtures for a league on a calendar date (Free-plan friendly via date filter). */
export async function getLeagueFixturesOnDate(leagueId: number, date: string) {
  const result = await searchFixturesSmart({ league: leagueId, date });
  return result;
}

/** Recent finished fixtures in a league (newest first). May need Pro for league+season. */
export async function getLeagueRecentResults(
  leagueId: number,
  season: number,
  last = 12
) {
  return afFetch<AfFixture[]>(
    "/fixtures",
    { league: leagueId, season, last, status: "FT-AET-PEN" },
    120_000
  );
}

/** Upcoming fixtures in a league (soonest first). */
export async function getLeagueUpcoming(
  leagueId: number,
  season: number,
  next = 12
) {
  return afFetch<AfFixture[]>(
    "/fixtures",
    { league: leagueId, season, next },
    60_000
  );
}

/** Live fixtures for a league (in-play). Empty when none live. */
export async function getLeagueLive(leagueId: number) {
  return afFetch<AfFixture[]>(
    "/fixtures",
    { league: leagueId, live: "all" },
    15_000
  );
}
/* ── Dossier helpers (transfers / sidelined / fixture players) ── */

export type AfTransferRow = {
  player?: { id?: number; name?: string };
  update?: string;
  transfers?: {
    date?: string;
    type?: string | null;
    teams?: {
      in?: { id?: number; name?: string; logo?: string } | null;
      out?: { id?: number; name?: string; logo?: string } | null;
    };
  }[];
};

export async function getPlayerTransfers(playerId: number) {
  return afFetch<AfTransferRow[]>("/transfers", { player: playerId }, 300_000);
}

export async function getTeamTransfers(teamId: number) {
  return afFetch<AfTransferRow[]>("/transfers", { team: teamId }, 300_000);
}

export type AfSidelinedRow = {
  type?: string | null;
  start?: string | null;
  end?: string | null;
};

export async function getPlayerSidelined(playerId: number) {
  return afFetch<AfSidelinedRow[]>("/sidelined", { player: playerId }, 300_000);
}

export async function getCoachSidelined(coachId: number) {
  return afFetch<AfSidelinedRow[]>("/sidelined", { coach: coachId }, 300_000);
}

/**
 * AF `/fixtures?player=` is unsupported on current plans ("Player field do not exist").
 * Soft-fail empty — callers should prefer getPlayerFormViaTeam.
 */
export async function getPlayerRecentFixtures(playerId: number, last = 8) {
  try {
    return await afFetch<AfFixture[]>(
      "/fixtures",
      { player: playerId, last },
      60_000
    );
  } catch {
    return [];
  }
}

export type AfPlayerProfile = {
  player: {
    id: number;
    name: string;
    firstname?: string;
    lastname?: string;
    age?: number | null;
    nationality?: string | null;
    height?: string | null;
    weight?: string | null;
    photo?: string | null;
    number?: number | null;
    position?: string | null;
    foot?: string | null;
    birth?: { date?: string | null; place?: string | null; country?: string | null };
  };
};

/** AF /players/profiles — static bio; may include foot when AF has it. */
export async function getPlayerProfile(playerId: number) {
  const list = await afFetch<AfPlayerProfile[]>(
    "/players/profiles",
    { player: playerId },
    300_000
  );
  return list[0] || null;
}

export type PlayerFormRow = {
  fixtureId: number;
  date: string;
  opponent: string;
  opponentLogo?: string | null;
  league?: string | null;
  leagueLogo?: string | null;
  result: "W" | "D" | "L" | null;
  homeAway: "H" | "A" | null;
  score: string;
  rating: string | null;
  started: boolean | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  yellow: number | null;
  red: number | null;
  played: boolean;
};

/**
 * Last-N form for a player via club team fixtures + /fixtures/players.
 * (Direct /fixtures?player= is not available on free/current plan.)
 */
export async function getPlayerFormViaTeam(
  playerId: number,
  teamId: number,
  last = 6
): Promise<PlayerFormRow[]> {
  const fixtures = await getTeamRecentFinished(teamId, Math.max(last + 4, 10));
  const out: PlayerFormRow[] = [];
  const slice = fixtures.slice(0, Math.max(last + 4, 8));
  const packs = await Promise.all(
    slice.map(async (fx) => {
      try {
        const fp = await getFixturePlayers(fx.fixture.id);
        return { fx, fp };
      } catch {
        return { fx, fp: null as Awaited<ReturnType<typeof getFixturePlayers>> | null };
      }
    })
  );
  for (const { fx, fp } of packs) {
    const home = fx.teams?.home;
    const away = fx.teams?.away;
    const gh = fx.goals?.home;
    const ga = fx.goals?.away;
    let homeAway: "H" | "A" | null =
      home?.id === teamId ? "H" : away?.id === teamId ? "A" : null;
    let opponent = "—";
    let opponentLogo: string | null = null;
    let result: "W" | "D" | "L" | null = null;
    if (homeAway === "H") {
      opponent = away?.name || "—";
      opponentLogo = away?.logo || null;
      if (gh != null && ga != null) result = gh > ga ? "W" : gh < ga ? "L" : "D";
    } else if (homeAway === "A") {
      opponent = home?.name || "—";
      opponentLogo = home?.logo || null;
      if (gh != null && ga != null) result = ga > gh ? "W" : ga < gh ? "L" : "D";
    }
    let rating: string | null = null;
    let started: boolean | null = null;
    let minutes: number | null = null;
    let goals: number | null = null;
    let assists: number | null = null;
    let yellow: number | null = null;
    let red: number | null = null;
    let played = false;
    if (fp) {
      for (const teamBlock of fp) {
        for (const pl of teamBlock.players || []) {
          if (pl.player?.id !== playerId) continue;
          played = true;
          const st = pl.statistics?.[0];
          rating = st?.games?.rating != null ? String(st.games.rating) : null;
          if (st?.games?.substitute === true) started = false;
          else if (st?.games?.substitute === false) started = true;
          else if (st?.games?.minutes != null) started = true;
          minutes = st?.games?.minutes ?? null;
          goals = st?.goals?.total ?? null;
          assists = st?.goals?.assists ?? null;
          yellow = st?.cards?.yellow ?? null;
          red = st?.cards?.red ?? null;
          if (teamBlock.team?.id === home?.id) homeAway = "H";
          if (teamBlock.team?.id === away?.id) homeAway = "A";
          if (gh != null && ga != null && homeAway) {
            if (homeAway === "H") result = gh > ga ? "W" : gh < ga ? "L" : "D";
            else result = ga > gh ? "W" : ga < gh ? "L" : "D";
            opponent = homeAway === "H" ? away?.name || "—" : home?.name || "—";
            opponentLogo =
              homeAway === "H" ? away?.logo || null : home?.logo || null;
          }
        }
      }
    }
    // Prefer appearances; still record DNP rows until we have `last` played rows
    if (!played && out.filter((r) => r.played).length >= last) continue;
    out.push({
      fixtureId: fx.fixture.id,
      date: fx.fixture?.date || "",
      opponent,
      opponentLogo,
      league: fx.league?.name || null,
      leagueLogo: (fx.league as { logo?: string } | undefined)?.logo || null,
      result,
      homeAway,
      score: gh != null && ga != null ? `${gh}-${ga}` : "—",
      rating,
      started,
      minutes,
      goals,
      assists,
      yellow,
      red,
      played,
    });
    if (out.filter((r) => r.played).length >= last) break;
    if (out.length >= last + 2) break;
  }
  // Prefer played rows first, cap at `last`
  const played = out.filter((r) => r.played);
  if (played.length >= last) return played.slice(0, last);
  return out.slice(0, last);
}

export type AfFixturePlayerStat = {
  team: { id: number; name: string; logo?: string };
  players: {
    player: {
      id: number;
      name: string;
      photo?: string;
    };
    statistics: {
      games?: {
        minutes?: number | null;
        number?: number | null;
        position?: string | null;
        rating?: string | null;
        captain?: boolean;
        substitute?: boolean;
      };
      goals?: {
        total?: number | null;
        assists?: number | null;
        conceded?: number | null;
        saves?: number | null;
      };
      shots?: { total?: number | null; on?: number | null };
      passes?: {
        total?: number | null;
        key?: number | null;
        accuracy?: string | number | null;
      };
      tackles?: {
        total?: number | null;
        blocks?: number | null;
        interceptions?: number | null;
      };
      duels?: { total?: number | null; won?: number | null };
      dribbles?: {
        attempts?: number | null;
        success?: number | null;
        past?: number | null;
      };
      fouls?: { drawn?: number | null; committed?: number | null };
      cards?: { yellow?: number | null; red?: number | null };
      penalty?: {
        won?: number | null;
        commited?: number | null;
        scored?: number | null;
        missed?: number | null;
        saved?: number | null;
      };
    }[];
  }[];
};

export async function getFixturePlayers(fixtureId: number) {
  return afFetch<AfFixturePlayerStat[]>(
    "/fixtures/players",
    { fixture: fixtureId },
    30_000
  );
}

export type AfTrophyRow = {
  league?: string | null;
  country?: string | null;
  season?: string | null;
  place?: string | null;
};

export async function getPlayerTrophies(playerId: number) {
  return afFetch<AfTrophyRow[]>("/trophies", { player: playerId }, 300_000);
}

export async function getTeamTrophies(teamId: number) {
  return afFetch<AfTrophyRow[]>("/trophies", { team: teamId }, 300_000);
}

export type AfLeagueInfo = {
  league: {
    id: number;
    name: string;
    type?: string;
    logo?: string;
  };
  country: { name?: string; code?: string | null; flag?: string | null };
  seasons?: {
    year: number;
    start?: string;
    end?: string;
    current?: boolean;
    coverage?: Record<string, unknown>;
  }[];
};

export async function getLeagueById(leagueId: number) {
  const list = await afFetch<AfLeagueInfo[]>("/leagues", { id: leagueId }, 300_000);
  return list[0] || null;
}


/** H2H fixtures between two teams (AF /fixtures/headtohead). */
export async function getHeadToHead(teamA: number, teamB: number, last = 10) {
  return afFetch<AfFixture[]>(
    "/fixtures/headtohead",
    { h2h: `${teamA}-${teamB}`, last },
    120_000
  );
}

/** Upcoming fixtures for a team. */
export async function getTeamUpcoming(teamId: number, next = 8) {
  return afFetch<AfFixture[]>(
    "/fixtures",
    { team: teamId, next },
    120_000
  );
}

/** All coaches historically returned for a team (unsorted). */
export async function listCoachesByTeam(teamId: number) {
  return afFetch<AfCoach[]>("/coachs", { team: teamId }, 300_000);
}
