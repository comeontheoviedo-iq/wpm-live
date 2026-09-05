import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { europeanSeasonYear } from "@/lib/season";
import {
  getTeam,
  getTeamRecentFinished,
  getTeamTransfers,
  getTeamTrophies,
  getCoachByTeam,
  getStandings,
  getSquads,
} from "@/lib/api-football";
import { leagueIdForCompetition } from "@/lib/competitions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");

  const club = await prisma.club.findUnique({
    where: { id },
    include: {
      players: { orderBy: [{ shirtNumber: "asc" }, { name: "asc" }] },
      coaches: true,
      injuries: { take: 12, orderBy: { injuryType: "asc" } },
    },
  });
  if (!club) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = matchId
    ? await prisma.note.findMany({
        where: { matchId, OR: [{ entityId: id }, { entityType: "club", entityId: id }] },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      })
    : await prisma.note.findMany({
        where: { entityId: id },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      });

  let afTeam: Awaited<ReturnType<typeof getTeam>> | null = null;
  let recent: Awaited<ReturnType<typeof getTeamRecentFinished>> = [];
  let transfers: {
    date: string;
    type: string | null;
    player: string;
    from: string;
    to: string;
  }[] = [];
  let trophies: { league: string; season?: string | null; place?: string | null }[] = [];
  let coach: Awaited<ReturnType<typeof getCoachByTeam>> | null = null;
  let standingsRow: {
    rank: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gd: number;
    points: number;
    form?: string | null;
  } | null = null;
  let schedule: {
    date: string;
    home: string;
    away: string;
    score: string;
    status: string;
  }[] = [];
  let afStub: string | null = null;

  const afId = club.apiFootballTeamId;
  if (afId) {
    try {
      afTeam = await getTeam(afId).catch(() => null);
      recent = await getTeamRecentFinished(afId, 8).catch(() => []);
      schedule = (recent || []).slice(0, 8).map((fx) => ({
        date: fx.fixture?.date || "",
        home: fx.teams?.home?.name || "—",
        away: fx.teams?.away?.name || "—",
        score:
          fx.goals?.home != null && fx.goals?.away != null
            ? `${fx.goals.home}–${fx.goals.away}`
            : "—",
        status: fx.fixture?.status?.short || "",
      }));
      const tr = await getTeamTransfers(afId).catch(() => []);
      for (const row of tr || []) {
        const pname = row.player?.name || "Player";
        for (const x of row.transfers || []) {
          transfers.push({
            date: x.date || "",
            type: x.type || null,
            player: pname,
            from: x.teams?.out?.name || "—",
            to: x.teams?.in?.name || "—",
          });
        }
      }
      transfers = transfers
        .filter((x) => x.date)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 24);
      const trop = await getTeamTrophies(afId).catch(() => []);
      trophies = (trop || [])
        .map((x) => ({
          league: x.league || "Trophy",
          season: x.season || null,
          place: x.place || null,
        }))
        .slice(0, 40);
      coach = await getCoachByTeam(afId).catch(() => null);

      if (matchId) {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: { matchDay: true },
        });
        const lid = match
          ? leagueIdForCompetition(match.matchDay.competition)
          : null;
        const season = europeanSeasonYear(match?.kickoff || new Date());
        if (lid) {
          const st = await getStandings(lid, season).catch(() => []);
          const table = st[0]?.league?.standings?.[0] || [];
          const hit = table.find((r) => r.team.id === afId);
          if (hit) {
            standingsRow = {
              rank: hit.rank,
              played: hit.all?.played ?? 0,
              won: hit.all?.win ?? 0,
              drawn: hit.all?.draw ?? 0,
              lost: hit.all?.lose ?? 0,
              gd: hit.goalsDiff ?? 0,
              points: hit.points ?? 0,
              form: hit.form || null,
            };
          }
        }
      }
      // Soft squad refresh hint only — local players already loaded
      await getSquads(afId).catch(() => null);
    } catch (e) {
      afStub = "Club stats temporarily unavailable";
      console.error("[clubs/:id]", e instanceof Error ? e.message : e);
    }
  } else {
    afStub = "No feed team id linked for this club";
  }

  const logoUrl = afId
    ? `https://media.api-sports.io/football/teams/${afId}.png`
    : null;

  return NextResponse.json({
    club: {
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
      fansApprox: club.fansApprox,
      apiFootballTeamId: club.apiFootballTeamId,
      logoUrl,
      venue: afTeam?.venue
        ? {
            name: afTeam.venue.name,
            city: afTeam.venue.city,
            capacity: afTeam.venue.capacity,
            image: afTeam.venue.image || null,
          }
        : null,
      country: afTeam?.team?.country || null,
    },
    squad: club.players.map((pl) => ({
      id: pl.id,
      name: pl.name,
      shirtNumber: pl.shirtNumber,
      position: pl.position,
      nationality: pl.nationality,
      age: pl.age,
      isCaptain: pl.isCaptain,
      goals: pl.goals,
      assists: pl.assists,
      appearances: pl.appearances,
      photoUrl: pl.photoUrl,
    })),
    coaches: club.coaches.map((c) => ({
      id: c.id,
      name: c.name,
      nationality: c.nationality,
      age: c.age,
      role: c.role,
      photoUrl: c.photoUrl,
    })),
    afCoach: coach
      ? {
          id: coach.id,
          name: coach.name,
          nationality: coach.nationality,
          age: coach.age,
          photo: coach.photo,
          career: (coach.career || []).slice(0, 8),
        }
      : null,
    injuries: club.injuries.map((i) => ({
      id: i.id,
      status: i.status,
      injuryType: i.injuryType,
      expectedReturn: i.expectedReturn,
      playerId: i.playerId,
    })),
    notes,
    transfers,
    trophies,
    standingsRow,
    schedule,
    afStub,
  });
}
