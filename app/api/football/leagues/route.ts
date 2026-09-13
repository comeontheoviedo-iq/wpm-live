import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
  searchLeagues,
} from "@/lib/api-football";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";

export const dynamic = "force-dynamic";

type FlatLeague = {
  id: number;
  apiFootballLeagueId: number;
  name: string;
  country: string;
  type: string | null;
  season: number | null;
  logo?: string | null;
};

function mapPriority(q: string): FlatLeague[] {
  return PRIORITY_COMPETITIONS.filter(
    (c) =>
      c.apiFootballLeagueId &&
      (!q ||
        c.name.toLowerCase().includes(q.toLowerCase()) ||
        c.country.toLowerCase().includes(q.toLowerCase()) ||
        c.broadcastName.toLowerCase().includes(q.toLowerCase()))
  ).map((c) => ({
    id: c.apiFootballLeagueId!,
    apiFootballLeagueId: c.apiFootballLeagueId!,
    name: c.name,
    country: c.country,
    type: "League",
    season: null,
    logo: null,
  }));
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") || "";

  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      configured: false,
      leagues: mapPriority(q),
      message:
        "API_FOOTBALL_KEY missing — showing seeded priority competitions only",
    });
  }

  if (!q.trim()) {
    return NextResponse.json({
      configured: true,
      leagues: mapPriority(""),
    });
  }

  try {
    const raw = await searchLeagues(q.trim());
    const leagues: FlatLeague[] = [];
    for (const row of raw || []) {
      const seasons = row.seasons;
      const current =
        seasons?.find((s) => s.current)?.year ??
        seasons?.[seasons.length - 1]?.year ??
        null;
      const id = row.league?.id;
      if (!id || !row.league?.name) continue;
      leagues.push({
        id,
        apiFootballLeagueId: id,
        name: row.league.name,
        country: row.country?.name || "Unknown",
        type: row.league.type || null,
        season: current,
        logo: row.league.logo || null,
      });
      if (leagues.length >= 40) break;
    }

    return NextResponse.json({ configured: true, leagues });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      {
        configured: true,
        error: err.message,
        leagues: mapPriority(q),
        message: "Live-feed search failed — showing priority matches",
      },
      { status: err.status && err.status < 500 ? err.status : 200 }
    );
  }
}
