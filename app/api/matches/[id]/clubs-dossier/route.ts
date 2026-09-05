import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leagueIdForCompetition } from "@/lib/competitions";
import { europeanSeasonYear } from "@/lib/season";
import {
  getTeam,
  getStandings,
  getTeamRecentFinished,
  getTeamUpcoming,
  getHeadToHead,
  getTeamTrophies,
  getTeamTransfers,
  getSquads,
  listCoachesByTeam,
  getInjuriesByFixture,
  isApiFootballConfigured,
} from "@/lib/api-football";
import { flagUrl } from "@/lib/flags";

function formFromFixtures(
  fixtures: Awaited<ReturnType<typeof getTeamRecentFinished>>,
  teamId: number,
  n = 5
) {
  const out: { result: "W" | "D" | "L"; score: string; vs: string; date?: string }[] = [];
  for (const fx of fixtures.slice(0, n)) {
    const home = fx.teams.home.id === teamId;
    const gf = home ? fx.goals?.home : fx.goals?.away;
    const ga = home ? fx.goals?.away : fx.goals?.home;
    if (gf == null || ga == null) continue;
    const result: "W" | "D" | "L" = gf > ga ? "W" : gf < ga ? "L" : "D";
    const vs = home ? fx.teams.away.name : fx.teams.home.name;
    out.push({
      result,
      score: `${gf}-${ga}`,
      vs,
      date: fx.fixture?.date,
    });
  }
  return out;
}

async function buildClubPayload(opts: {
  club: {
    id: string;
    name: string;
    shortName: string;
    abbreviation: string;
    primaryColor: string;
    secondaryColor: string;
    founded: number | null;
    city: string | null;
    stadiumName: string | null;
    nickname: string | null;
    apiFootballTeamId: number | null;
    coaches: { id: string; name: string; nationality: string; age: number | null; role: string; photoUrl: string | null; apiFootballCoachId: number | null }[];
    players: {
      id: string;
      name: string;
      shirtNumber: number;
      position: string;
      nationality: string;
      photoUrl: string | null;
      apiFootballPlayerId: number | null;
    }[];
  };
  opponentAfId: number | null;
  matchId: string;
  competition: string;
  kickoff: Date;
  fixtureId: number | null;
}) {
  const { club, opponentAfId, matchId, competition, kickoff, fixtureId } = opts;
  const afId = club.apiFootballTeamId;
  const season = europeanSeasonYear(kickoff);
  const leagueId = leagueIdForCompetition(competition);

  const notes = await prisma.note.findMany({
    where: {
      matchId,
      OR: [
        { entityType: "club", entityId: club.id },
        { entityType: "team", entityId: club.id },
      ],
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });

  const base = {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    abbreviation: club.abbreviation,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    founded: club.founded,
    city: club.city,
    stadiumName: club.stadiumName,
    nickname: club.nickname,
    apiFootballTeamId: afId,
    crestUrl: afId
      ? `https://media.api-sports.io/football/teams/${afId}.png`
      : null,
    countryFlag: null as string | null,
    country: null as string | null,
    venue: null as null | {
      name?: string | null;
      city?: string | null;
      capacity?: number | null;
      surface?: string | null;
      image?: string | null;
    },
    form: [] as ReturnType<typeof formFromFixtures>,
    standing: null as null | {
      rank: number;
      points: number;
      played: number;
      win: number;
      draw: number;
      lose: number;
      gf: number;
      ga: number;
      gd: number;
      form: string | null;
      description: string | null;
    },
    h2h: {
      summary: null as string | null,
      results: [] as { date?: string; home: string; away: string; score: string; winner: string | null }[],
    },
    trophies: [] as { league?: string | null; country?: string | null; season?: string | null; place?: string | null }[],
    transfers: { in: [] as unknown[], out: [] as unknown[] },
    coaches: club.coaches,
    afCoaches: [] as { id: number; name: string; photo?: string | null; nationality?: string | null; start?: string | null; end?: string | null }[],
    squad: club.players,
    afSquad: [] as { id: number; name: string; number: number | null; position: string | null; photo?: string }[],
    schedule: { live: [] as unknown[], upcoming: [] as unknown[], recent: [] as unknown[] },
    sidelined: [] as { player?: string; type?: string | null; start?: string | null; end?: string | null }[],
    contracts: { soon: [] as unknown[], mid: [] as unknown[], note: "AF does not publish contract expiry buckets for this desk — honest empty." },
    bio: null as string | null,
    funfact: null as string | null,
    notes,
    messages: [] as string[],
  };

  if (!afId || !isApiFootballConfigured()) {
    base.messages.push("API-Football not configured or club has no AF id — showing desk data only");
    return base;
  }

  try {
    const team = await getTeam(afId);
    if (team) {
      base.country = team.team.country || null;
      base.countryFlag = flagUrl(team.team.country || null, 40);
      if (team.team.founded && !base.founded) base.founded = team.team.founded;
      base.venue = team.venue
        ? {
            name: team.venue.name,
            city: team.venue.city,
            capacity: team.venue.capacity,
            surface: team.venue.surface,
            image: team.venue.image,
          }
        : null;
      if (!base.stadiumName && team.venue?.name) base.stadiumName = team.venue.name;
      if (!base.city && team.venue?.city) base.city = team.venue.city;
    }
  } catch (e) {
    base.messages.push(`Team profile soft-failed: ${e instanceof Error ? e.message : "error"}`);
  }

  try {
    const recent = await getTeamRecentFinished(afId, 8);
    base.form = formFromFixtures(recent, afId, 5);
    base.schedule.recent = recent.slice(0, 8).map((fx) => ({
      id: fx.fixture.id,
      date: fx.fixture.date,
      home: fx.teams.home.name,
      away: fx.teams.away.name,
      score: `${fx.goals?.home ?? "—"}-${fx.goals?.away ?? "—"}`,
      status: fx.fixture.status?.short,
    }));
  } catch {
    base.messages.push("Recent form unavailable");
  }

  try {
    const upcoming = await getTeamUpcoming(afId, 8);
    base.schedule.upcoming = upcoming.map((fx) => ({
      id: fx.fixture.id,
      date: fx.fixture.date,
      home: fx.teams.home.name,
      away: fx.teams.away.name,
      status: fx.fixture.status?.short,
    }));
  } catch {
    /* optional */
  }

  if (leagueId) {
    try {
      const rows = await getStandings(leagueId, season);
      const table = rows?.[0]?.league?.standings?.[0] || [];
      const row = table.find((r) => r.team.id === afId);
      if (row) {
        base.standing = {
          rank: row.rank,
          points: row.points,
          played: row.all.played,
          win: row.all.win,
          draw: row.all.draw,
          lose: row.all.lose,
          gf: row.all.goals.for,
          ga: row.all.goals.against,
          gd: row.goalsDiff,
          form: row.form || null,
          description: row.description || null,
        };
      }
    } catch {
      base.messages.push("Standings soft-failed");
    }
  }

  if (opponentAfId) {
    try {
      const h2h = await getHeadToHead(afId, opponentAfId, 10);
      let w = 0, d = 0, l = 0;
      for (const fx of h2h) {
        const home = fx.teams.home.id === afId;
        const gf = home ? fx.goals?.home : fx.goals?.away;
        const ga = home ? fx.goals?.away : fx.goals?.home;
        if (gf == null || ga == null) continue;
        if (gf > ga) w++;
        else if (gf < ga) l++;
        else d++;
        base.h2h.results.push({
          date: fx.fixture?.date,
          home: fx.teams.home.name,
          away: fx.teams.away.name,
          score: `${fx.goals?.home ?? "—"}-${fx.goals?.away ?? "—"}`,
          winner:
            fx.goals?.home == null || fx.goals?.away == null
              ? null
              : fx.goals.home > fx.goals.away
                ? fx.teams.home.name
                : fx.goals.away > fx.goals.home
                  ? fx.teams.away.name
                  : "Draw",
        });
      }
      base.h2h.summary = `Last ${base.h2h.results.length} H2H: ${w}–${d}–${l} (W–D–L for ${club.shortName})`;
    } catch {
      base.messages.push("H2H soft-failed");
    }
  }

  try {
    base.trophies = await getTeamTrophies(afId);
  } catch {
    /* optional */
  }

  try {
    const transfers = await getTeamTransfers(afId);
    const inRows: unknown[] = [];
    const outRows: unknown[] = [];
    for (const row of transfers) {
      for (const tr of row.transfers || []) {
        const type = (tr.type || "").toLowerCase();
        const entry = {
          player: row.player?.name,
          playerId: row.player?.id,
          date: tr.date,
          type: tr.type || null,
          from: tr.teams?.out?.name || null,
          to: tr.teams?.in?.name || null,
        };
        if (tr.teams?.in?.id === afId) inRows.push(entry);
        if (tr.teams?.out?.id === afId) outRows.push(entry);
        void type;
      }
    }
    base.transfers = { in: inRows.slice(0, 40), out: outRows.slice(0, 40) };
  } catch {
    /* optional */
  }

  try {
    const coaches = await listCoachesByTeam(afId);
    base.afCoaches = coaches.map((c) => {
      const stint = (c.career || []).find((x) => x.team?.id === afId);
      return {
        id: c.id,
        name: c.name,
        photo: c.photo,
        nationality: c.nationality,
        start: stint?.start || null,
        end: stint?.end || null,
      };
    });
  } catch {
    /* optional */
  }

  try {
    const squad = await getSquads(afId);
    const players = squad?.[0]?.players || [];
    base.afSquad = players.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number ?? null,
      position: p.position ?? null,
      photo: p.photo || undefined,
    }));
  } catch {
    /* use desk squad */
  }

  if (fixtureId) {
    try {
      const injuries = await getInjuriesByFixture(fixtureId);
      base.sidelined = injuries
        .filter((i) => i.team?.id === afId)
        .map((i) => ({
          player: i.player?.name,
          type: i.player?.type || i.player?.reason || null,
          start: null,
          end: null,
        }));
    } catch {
      /* optional */
    }
  }

  return base;
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
      homeClub: { include: { coaches: true, players: { orderBy: { shirtNumber: "asc" } } } },
      awayClub: { include: { coaches: true, players: { orderBy: { shirtNumber: "asc" } } } },
    },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const home = await buildClubPayload({
    club: match.homeClub,
    opponentAfId: match.awayClub.apiFootballTeamId,
    matchId: match.id,
    competition: match.matchDay.competition,
    kickoff: match.kickoff,
    fixtureId: match.apiFootballFixtureId,
  });
  const away = await buildClubPayload({
    club: match.awayClub,
    opponentAfId: match.homeClub.apiFootballTeamId,
    matchId: match.id,
    competition: match.matchDay.competition,
    kickoff: match.kickoff,
    fixtureId: match.apiFootballFixtureId,
  });

  return NextResponse.json({
    matchId: match.id,
    competition: match.matchDay.competition,
    home,
    away,
  });
}
