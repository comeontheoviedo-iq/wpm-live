import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leagueIdForCompetition } from "@/lib/competitions";
import { europeanSeasonYear, todayDateInput } from "@/lib/season";
import {
  ApiFootballError,
  getLeagueById,
  getLeagueLive,
  getLeagueRecentResults,
  getLeagueUpcoming,
  getStandings,
  isApiFootballConfigured,
  searchFixturesSmart,
  type AfFixture,
  type AfStandingTeam,
} from "@/lib/api-football";
import { PRIORITY_COMPETITIONS } from "@/lib/competitions";

function slimFixture(fx: AfFixture) {
  const venueName = fx.fixture.venue?.name || null;
  const venueCity = fx.fixture.venue?.city || null;
  return {
    id: fx.fixture.id,
    date: fx.fixture.date,
    status: fx.fixture.status?.short || "",
    statusLong: fx.fixture.status?.long || "",
    elapsed: fx.fixture.status?.elapsed ?? null,
    home: {
      id: fx.teams.home.id,
      name: fx.teams.home.name,
      logo: fx.teams.home.logo,
    },
    away: {
      id: fx.teams.away.id,
      name: fx.teams.away.name,
      logo: fx.teams.away.logo,
    },
    goals: { home: fx.goals?.home ?? null, away: fx.goals?.away ?? null },
    round: fx.league?.round || null,
    competition: fx.league?.name || null,
    venue: venueName || venueCity
      ? { name: venueName, city: venueCity }
      : null,
  };
}

function slimStanding(row: AfStandingTeam) {
  return {
    rank: row.rank,
    teamId: row.team.id,
    team: row.team.name,
    logo: row.team.logo,
    played: row.all?.played ?? 0,
    won: row.all?.win ?? 0,
    drawn: row.all?.draw ?? 0,
    lost: row.all?.lose ?? 0,
    gf: row.all?.goals?.for ?? 0,
    ga: row.all?.goals?.against ?? 0,
    gd: row.goalsDiff ?? 0,
    points: row.points ?? 0,
    form: row.form || null,
    description: row.description || null,
  };
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
    include: {
      matchDay: true,
      homeClub: true,
      awayClub: true,
    },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const competition = match.matchDay.competition;
  const leagueId = leagueIdForCompetition(competition);
  const season = europeanSeasonYear(match.kickoff);
  const today = todayDateInput("Europe/London");

  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      configured: false,
      competition,
      leagueId,
      season,
      standings: [],
      recent: [],
      upcoming: [],
      live: [],
      todayFixtures: [],
      message:
        "Live-feed key is not set — League tab needs the live feed for standings & fixtures.",
    });
  }

  if (!leagueId) {
    return NextResponse.json({
      configured: true,
      competition,
      leagueId: null,
      season,
      standings: [],
      recent: [],
      upcoming: [],
      live: [],
      todayFixtures: [],
      message: `No live-feed league id mapped for “${competition}”. Pick a priority competition on create, or link a fixture.`,
    });
  }

  const warnings: string[] = [];
  let standings: ReturnType<typeof slimStanding>[] = [];
  let recent: ReturnType<typeof slimFixture>[] = [];
  let upcoming: ReturnType<typeof slimFixture>[] = [];
  let live: ReturnType<typeof slimFixture>[] = [];
  let todayFixtures: ReturnType<typeof slimFixture>[] = [];
  let standingsSeason = season;

  async function tryStandings(s: number) {
    const rows = await getStandings(leagueId!, s);
    const league = rows[0]?.league;
    const table = league?.standings?.[0] || [];
    return { table, seasonUsed: league?.season ?? s, name: league?.name };
  }

  try {
    try {
      const s = await tryStandings(season);
      standings = s.table.map(slimStanding);
      standingsSeason = s.seasonUsed;
    } catch (e) {
      const err = e as ApiFootballError;
      if (err.code === "plan_season") {
        warnings.push(
          "Standings for this season need a higher live-feed plan — table empty for now."
        );
      } else {
        warnings.push(`Standings unavailable: ${err.message}`);
      }
      try {
        const s = await tryStandings(season - 1);
        if (s.table.length) {
          standings = s.table.map(slimStanding);
          standingsSeason = s.seasonUsed;
          warnings.push(`Showing standings for season ${standingsSeason} (fallback).`);
        }
      } catch {
        /* keep empty */
      }
    }

    try {
      const fx = await getLeagueRecentResults(leagueId, season, 12);
      recent = fx.map(slimFixture);
    } catch (e) {
      const err = e as ApiFootballError;
      if (err.code === "plan_season") {
        warnings.push("Recent results need league+season (Pro on Free plan).");
      } else {
        warnings.push(`Recent results unavailable: ${err.message}`);
      }
    }

    try {
      const fx = await getLeagueUpcoming(leagueId, season, 12);
      upcoming = fx.map(slimFixture);
    } catch (e) {
      const err = e as ApiFootballError;
      if (err.code === "plan_season") {
        warnings.push("Upcoming fixtures need league+season (Pro on Free plan).");
      } else {
        warnings.push(`Upcoming fixtures unavailable: ${err.message}`);
      }
    }

    try {
      const fx = await getLeagueLive(leagueId);
      live = fx.map(slimFixture);
    } catch (e) {
      const err = e as ApiFootballError;
      warnings.push(`Live scores unavailable: ${err.message}`);
    }

    try {
      const day = await searchFixturesSmart({ league: leagueId, date: today });
      todayFixtures = day.fixtures.map(slimFixture);
      if (day.message) warnings.push(day.message);
    } catch (e) {
      const err = e as ApiFootballError;
      warnings.push(`Today’s fixtures unavailable: ${err.message}`);
    }
  } catch (e) {
    const err = e as ApiFootballError;
    return NextResponse.json(
      {
        configured: true,
        competition,
        leagueId,
        season,
        error: err.message,
        code: err.code,
        standings: [],
        recent: [],
        upcoming: [],
        live: [],
        todayFixtures: [],
        message: err.message,
      },
      { status: err.status && err.status >= 400 ? err.status : 200 }
    );
  }

  let leagueMeta: {
    name: string;
    logo: string | null;
    country: string | null;
    countryFlag: string | null;
    type: string | null;
    seasonsTracked: { year: number; current?: boolean; start?: string; end?: string }[];
  } | null = null;
  let hallOfFame: { season: number; champion: string | null; runnerUp: string | null; championLogo?: string | null; runnerUpLogo?: string | null }[] = [];
  let lastChampion: { season: number; name: string; logo?: string | null } | null = null;
  let lastRunnerUp: { season: number; name: string; logo?: string | null } | null = null;

  try {
    const info = await getLeagueById(leagueId!).catch(() => null);
    if (info) {
      leagueMeta = {
        name: info.league?.name || competition,
        logo: info.league?.logo || (leagueId ? `https://media.api-sports.io/football/leagues/${leagueId}.png` : null),
        country: info.country?.name || PRIORITY_COMPETITIONS.find((c) => c.apiFootballLeagueId === leagueId)?.country || null,
        countryFlag: info.country?.flag || null,
        type: info.league?.type || "League",
        seasonsTracked: (info.seasons || [])
          .slice()
          .sort((a, b) => b.year - a.year)
          .slice(0, 12)
          .map((s) => ({
            year: s.year,
            current: s.current,
            start: s.start,
            end: s.end,
          })),
      };
      // Hall of fame from prior seasons standings (soft, limited)
      const years = (info.seasons || [])
        .map((s) => s.year)
        .sort((a, b) => b - a)
        .filter((y) => y < season)
        .slice(0, 6);
      for (const y of years) {
        try {
          const rows = await getStandings(leagueId!, y);
          const table = rows[0]?.league?.standings?.[0] || [];
          const champ = table.find((r) => r.rank === 1);
          const runner = table.find((r) => r.rank === 2);
          hallOfFame.push({
            season: y,
            champion: champ?.team?.name || null,
            runnerUp: runner?.team?.name || null,
            championLogo: champ?.team?.logo || null,
            runnerUpLogo: runner?.team?.logo || null,
          });
        } catch {
          /* soft per season */
        }
      }
      if (hallOfFame[0]?.champion) {
        lastChampion = {
          season: hallOfFame[0].season,
          name: hallOfFame[0].champion!,
          logo: hallOfFame[0].championLogo,
        };
      }
      if (hallOfFame[0]?.runnerUp) {
        lastRunnerUp = {
          season: hallOfFame[0].season,
          name: hallOfFame[0].runnerUp!,
          logo: hallOfFame[0].runnerUpLogo,
        };
      }
    } else {
      const opt = PRIORITY_COMPETITIONS.find((c) => c.apiFootballLeagueId === leagueId);
      leagueMeta = {
        name: competition,
        logo: leagueId ? `https://media.api-sports.io/football/leagues/${leagueId}.png` : null,
        country: opt?.country || null,
        countryFlag: null,
        type: "League",
        seasonsTracked: [],
      };
    }
  } catch {
    /* soft */
  }

  const homeAf = match.homeClub.apiFootballTeamId;
  const awayAf = match.awayClub.apiFootballTeamId;

  return NextResponse.json({
    configured: true,
    competition,
    leagueId,
    season: standingsSeason,
    kickoffSeason: season,
    homeTeamId: homeAf,
    awayTeamId: awayAf,
    homeName: match.homeClub.name,
    awayName: match.awayClub.name,
    standings,
    recent,
    upcoming,
    live,
    todayFixtures,
    warnings,
    message:
      standings.length || recent.length || live.length || todayFixtures.length
        ? null
        : warnings[0] || "No league intel returned — check API plan / season.",
    leagueMeta,
    hallOfFame,
    lastChampion,
    lastRunnerUp,
  });
}
