import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
  searchFixtures,
} from "@/lib/api-football";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isApiFootballConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        fixtures: [],
        message:
          "API_FOOTBALL_KEY is not set. Add it to .env to import fixtures from API-Football.",
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || undefined;
  const league = searchParams.get("league");
  const season = searchParams.get("season");
  const team = searchParams.get("team");
  const id = searchParams.get("id");

  try {
    const fixtures = await searchFixtures({
      date,
      league: league ? Number(league) : undefined,
      season: season ? Number(season) : undefined,
      team: team ? Number(team) : undefined,
      id: id ? Number(id) : undefined,
    });
    return NextResponse.json({ configured: true, fixtures });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      { configured: true, error: err.message || "Lookup failed", fixtures: [] },
      { status: err.status || 502 }
    );
  }
}
