import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ApiFootballError,
  isApiFootballConfigured,
  searchFixturesSmart,
} from "@/lib/api-football";
import { europeanSeasonYear } from "@/lib/season";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isApiFootballConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        fixtures: [],
        message:
          "API_FOOTBALL_KEY is not set. Add it to .env / .env.local and restart the Next.js server.",
      },
      { status: 200 }
    );
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || undefined;
  const league = searchParams.get("league");
  const seasonParam = searchParams.get("season");
  const team = searchParams.get("team");
  const id = searchParams.get("id");

  // Season hint only for smart fallback; primary path is date-only (Free-plan safe).
  const season =
    seasonParam && seasonParam.trim()
      ? Number(seasonParam)
      : league && date
        ? europeanSeasonYear(date)
        : undefined;

  try {
    const result = await searchFixturesSmart({
      date,
      league: league ? Number(league) : undefined,
      season: Number.isFinite(season as number) ? (season as number) : undefined,
      team: team ? Number(team) : undefined,
      id: id ? Number(id) : undefined,
    });

    if (result.planSeasonBlocked) {
      return NextResponse.json(
        {
          configured: true,
          fixtures: [],
          seasonUsed: result.seasonUsed,
          triedSeasons: result.triedSeasons,
          strategy: result.strategy,
          planSeasonBlocked: true,
          code: "plan_season",
          message: result.message,
          error: result.message,
        },
        { status: 200 }
      );
    }

    let message = result.message;
    if (!message && result.fixtures.length === 0) {
      message = [
        "No fixtures — check key / date / season",
        date ? `date=${date}` : null,
        league ? `league=${league}` : null,
        result.triedSeasons?.length
          ? `seasonTried=${result.triedSeasons.join(",")}`
          : null,
        result.strategy ? `strategy=${result.strategy}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    return NextResponse.json({
      configured: true,
      fixtures: result.fixtures,
      seasonUsed: result.seasonUsed,
      triedSeasons: result.triedSeasons,
      strategy: result.strategy,
      message,
    });
  } catch (e) {
    const err = e as ApiFootballError;
    const planSeason = err.code === "plan_season";
    return NextResponse.json(
      {
        configured: true,
        error: err.message || "Lookup failed",
        code: err.code,
        fixtures: [],
        message: err.message || "Lookup failed",
        planSeasonBlocked: planSeason || undefined,
      },
      // Never opaque 502 for Free-plan season caps
      { status: planSeason ? 200 : err.status || 502 }
    );
  }
}
