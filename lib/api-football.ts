/**
 * API-Football (api-sports) client.
 * Base: https://v3.football.api-sports.io
 * Auth header: x-apisports-key
 */

import { getApiFootballKey } from "./env";

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

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 30_000;

export class ApiFootballError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function isApiFootballConfigured() {
  return Boolean(getApiFootballKey());
}

async function afFetch<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const key = getApiFootballKey();
  if (!key) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY is not set. Add it to .env to sync fixtures and lineups.",
      503
    );
  }

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs.toString()}`;
  const cacheKey = url;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.data as T;
  }

  const res = await fetch(url, {
    headers: {
      "x-apisports-key": key,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new ApiFootballError(
      `API-Football HTTP ${res.status}`,
      res.status
    );
  }

  const json = (await res.json()) as {
    errors?: unknown;
    response?: T;
    results?: number;
  };

  if (json.errors && Object.keys(json.errors as object).length > 0) {
    throw new ApiFootballError(
      `API-Football error: ${JSON.stringify(json.errors)}`,
      502
    );
  }

  const data = (json.response ?? []) as T;
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
  // defensive line
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
      return "Live";
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
