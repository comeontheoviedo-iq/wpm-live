import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leagueIdForCompetition } from "@/lib/competitions";
import { europeanSeasonYear, todayDateInput } from "@/lib/season";
import {
  ApiFootballError,
  getLeagueLive,
  getLeagueUpcoming,
  isApiFootballConfigured,
  searchFixturesSmart,
  type AfFixture,
} from "@/lib/api-football";

/** Slim chip for the desk scores strip — no standings / hall-of-fame / today dump. */
function slim(fx: AfFixture) {
  return {
    id: fx.fixture.id,
    date: fx.fixture.date,
    status: fx.fixture.status?.short || "",
    elapsed: fx.fixture.status?.elapsed ?? null,
    extra: fx.fixture.status?.extra ?? null,
    home: { id: fx.teams.home.id, name: fx.teams.home.name },
    away: { id: fx.teams.away.id, name: fx.teams.away.name },
    goals: { home: fx.goals?.home ?? null, away: fx.goals?.away ?? null },
  };
}

const UPCOMING_SHORT = new Set(["NS", "TBD", "PST"]);

function notThisDesk(id: number | null) {
  return (fx: ReturnType<typeof slim>) => !id || fx.id !== id;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: { matchDay: true },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const competition = match.matchDay.competition;
  const leagueId = leagueIdForCompetition(competition);
  const season = europeanSeasonYear(match.kickoff);
  const currentFixtureId = match.apiFootballFixtureId ?? null;

  const empty = {
    configured: isApiFootballConfigured(),
    competition,
    leagueId,
    season,
    currentFixtureId,
    mode: "empty" as const,
    fixtures: [] as ReturnType<typeof slim>[],
    message: null as string | null,
  };

  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      ...empty,
      message: "Live-feed key is not set.",
    });
  }

  if (!leagueId) {
    return NextResponse.json({
      ...empty,
      configured: true,
      message: `No league id mapped for “${competition}”.`,
    });
  }

  try {
    let live: ReturnType<typeof slim>[] = [];
    try {
      live = (await getLeagueLive(leagueId))
        .map(slim)
        .filter(notThisDesk(currentFixtureId));
    } catch (e) {
      const err = e as ApiFootballError;
      return NextResponse.json({
        ...empty,
        configured: true,
        message: err.message || "Live scores unavailable",
      });
    }

    if (live.length) {
      return NextResponse.json({
        ...empty,
        configured: true,
        mode: "live" as const,
        fixtures: live.slice(0, 8),
        message: null,
      });
    }

    let upcoming: ReturnType<typeof slim>[] = [];
    try {
      upcoming = (await getLeagueUpcoming(leagueId, season, 8))
        .map(slim)
        .filter(notThisDesk(currentFixtureId))
        .slice(0, 6);
    } catch (e) {
      const err = e as ApiFootballError;
      if (err.code !== "plan_season") {
        /* date fallback below */
      }
    }

    if (!upcoming.length) {
      try {
        const today = todayDateInput("Europe/London");
        const day = await searchFixturesSmart({ league: leagueId, date: today });
        upcoming = day.fixtures
          .map(slim)
          .filter(notThisDesk(currentFixtureId))
          .filter((fx) => UPCOMING_SHORT.has((fx.status || "").toUpperCase()))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 6);
      } catch {
        /* soft-fail empty */
      }
    }

    return NextResponse.json({
      ...empty,
      configured: true,
      mode: upcoming.length ? ("upcoming" as const) : ("empty" as const),
      fixtures: upcoming,
      message: upcoming.length ? null : "No other fixtures in this competition.",
    });
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json({
      ...empty,
      configured: true,
      message: err.message || "Competition scores unavailable",
    });
  }
}
