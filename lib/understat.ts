/**
 * Understat free xG client (no API key).
 * Endpoint: GET https://understat.com/getLeagueData/{league}/{season}
 * Optional: GET https://understat.com/getMatchData/{matchId} for shot summary.
 *
 * Coverage (Understat only): EPL, La Liga, Serie A, Bundesliga, Ligue 1, RFPL.
 * Not covered: Süper Lig, Scottish Premiership, UEFA cups, etc.
 */

import { gunzipSync } from "zlib";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type UnderstatLeagueSlug =
  | "EPL"
  | "La_liga"
  | "Serie_A"
  | "Bundesliga"
  | "Ligue_1"
  | "RFPL";

export type UnderstatDateRow = {
  id: string;
  isResult: boolean;
  datetime: string;
  h: { id: string; title: string; short_title?: string };
  a: { id: string; title: string; short_title?: string };
  goals: { h: string | null; a: string | null };
  xG: { h: string | null; a: string | null };
  forecast?: { w: string; d: string; l: string };
};

export type UnderstatShot = {
  id: string;
  minute: string;
  result: string;
  X: string;
  Y: string;
  xG: string;
  player: string;
  h_a: "h" | "a";
  situation?: string;
  shotType?: string;
};

export type UnderstatLeaguePayload = {
  dates: UnderstatDateRow[];
  teams?: Record<string, unknown>;
  players?: unknown;
};

export type UnderstatMatchPayload = {
  shots?: { h?: UnderstatShot[]; a?: UnderstatShot[] };
  rosters?: unknown;
  tmpl?: unknown;
};

async function understatFetchJson<T>(
  url: string,
  referer: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: referer,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Understat HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const text =
    buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
      ? gunzipSync(buf).toString("utf8")
      : buf.toString("utf8");
  return JSON.parse(text) as T;
}

export async function fetchUnderstatLeague(
  league: UnderstatLeagueSlug,
  season: number
): Promise<UnderstatLeaguePayload> {
  const slug = encodeURIComponent(league);
  const url = `https://understat.com/getLeagueData/${slug}/${season}`;
  const data = await understatFetchJson<UnderstatLeaguePayload>(
    url,
    `https://understat.com/league/${league}/${season}`
  );
  if (!data || !Array.isArray(data.dates)) {
    throw new Error("Understat league payload missing dates");
  }
  return data;
}

export async function fetchUnderstatMatch(
  matchId: string
): Promise<UnderstatMatchPayload> {
  const id = encodeURIComponent(matchId);
  return understatFetchJson<UnderstatMatchPayload>(
    `https://understat.com/getMatchData/${id}`,
    `https://understat.com/match/${matchId}`
  );
}
