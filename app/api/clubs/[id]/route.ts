import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { europeanSeasonYear } from "@/lib/season";
import {
  getTeam,
  getTeamRecentFinished,
  getTeamUpcoming,
  getTeamTransfers,
  getTeamTrophies,
  getCoachByTeam,
  getStandings,
  getSquads,
  listCoachesByTeam,
} from "@/lib/api-football";
import { leagueIdForMatchDay } from "@/lib/competitions";
import { resolvePersonAge } from "@/lib/person-age";
import { rawTransferFeeFrom, selectClubTransferHistory } from "@/lib/transfer-fee";

function isWinnerPlace(place: string | null | undefined) {
  if (!place) return false;
  return /^(winner|champion|1st|first|winners)$/i.test(place.trim());
}

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
      injuries: {
        take: 40,
        orderBy: { injuryType: "asc" },
        include: { player: true },
      },
    },
  });
  if (!club) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = matchId
    ? await prisma.note.findMany({
        where: {
          matchId,
          entityType: { in: ["club", "team"] },
          entityId: id,
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      })
    : await prisma.note.findMany({
        where: {
          entityType: { in: ["club", "team"] },
          entityId: id,
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      });

  let afTeam: Awaited<ReturnType<typeof getTeam>> | null = null;
  let transfers: {
    date: string;
    type: string | null;
    player: string;
    from: string;
    to: string;
  }[] = [];
  let trophies: {
    league: string;
    season?: string | null;
    place?: string | null;
    country?: string | null;
  }[] = [];
  let coach: Awaited<ReturnType<typeof getCoachByTeam>> | null = null;
  let formerCoaches: {
    id: number;
    name: string;
    nationality?: string | null;
    photo?: string | null;
    start?: string | null;
    end?: string | null;
  }[] = [];
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
    id: number | null;
    date: string;
    home: string;
    away: string;
    score: string;
    status: string;
    competition: string | null;
  }[] = [];
  let competitions: {
    name: string;
    results: {
      id: number | null;
      date: string;
      home: string;
      away: string;
      score: string;
      status: string;
    }[];
  }[] = [];
  let afStub: string | null = null;

  const afId = club.apiFootballTeamId;
  if (afId) {
    try {
      afTeam = await getTeam(afId).catch(() => null);
      const recent = await getTeamRecentFinished(afId, 12).catch(() => []);
      const upcoming = await getTeamUpcoming(afId, 6).catch(() => []);
      const allFx = [...(recent || []), ...(upcoming || [])];

      schedule = allFx.slice(0, 16).map((fx) => ({
        id: fx.fixture?.id ?? null,
        date: fx.fixture?.date || "",
        home: fx.teams?.home?.name || "—",
        away: fx.teams?.away?.name || "—",
        score:
          fx.goals?.home != null && fx.goals?.away != null
            ? `${fx.goals.home}–${fx.goals.away}`
            : "—",
        status: fx.fixture?.status?.short || "",
        competition: fx.league?.name || null,
      }));

      const byComp = new Map<
        string,
        {
          id: number | null;
          date: string;
          home: string;
          away: string;
          score: string;
          status: string;
        }[]
      >();
      for (const fx of recent || []) {
        const name = fx.league?.name || "Other";
        const row = {
          id: fx.fixture?.id ?? null,
          date: fx.fixture?.date || "",
          home: fx.teams?.home?.name || "—",
          away: fx.teams?.away?.name || "—",
          score:
            fx.goals?.home != null && fx.goals?.away != null
              ? `${fx.goals.home}–${fx.goals.away}`
              : "—",
          status: fx.fixture?.status?.short || "",
        };
        const list = byComp.get(name) || [];
        list.push(row);
        byComp.set(name, list);
      }
      competitions = Array.from(byComp.entries()).map(([name, results]) => ({
        name,
        results: results.slice(0, 8),
      }));

      const tr = await getTeamTransfers(afId).catch(() => []);
      for (const row of tr || []) {
        const pname = row.player?.name || "Player";
        for (const x of row.transfers || []) {
          transfers.push({
            date: x.date || "",
            type: rawTransferFeeFrom({
              type: x.type,
              fee: x.fee,
              transferFee: x.transferFee,
            }),
            player: pname,
            from: x.teams?.out?.name || "—",
            to: x.teams?.in?.name || "—",
          });
        }
      }
      // Keep recent activity AND money-fee rows from lookback (AF floods recent
      // window with Loan / Free agent / bare "Transfer" without amounts).
      transfers = selectClubTransferHistory(transfers, {
        limit: 60,
        moneyLookbackYears: 6,
        recentWindow: 50,
      });

      const trop = await getTeamTrophies(afId).catch(() => []);
      trophies = (trop || []).map((x) => ({
        league: x.league || "Trophy",
        season: x.season || null,
        place: x.place || null,
        country: x.country || null,
      }));

      coach = await getCoachByTeam(afId).catch(() => null);
      const coachesHist = await listCoachesByTeam(afId).catch(() => []);
      formerCoaches = (coachesHist || [])
        .map((c) => {
          const stints = (c.career || []).filter((x) => x.team?.id === afId);
          const closed = stints
            .filter((x) => x.end)
            .sort((a, b) => String(b.end || "").localeCompare(String(a.end || "")));
          const latest = closed[0];
          if (!latest) return null;
          return {
            id: c.id,
            name: c.name,
            nationality: c.nationality,
            photo: c.photo,
            start: latest.start || null,
            end: latest.end || null,
          };
        })
        .filter(Boolean)
        .slice(0, 12) as typeof formerCoaches;

      if (matchId) {
        const match = await prisma.match.findUnique({
          where: { id: matchId },
          include: { matchDay: true },
        });
        const lid = match
          ? leagueIdForMatchDay(match.matchDay)
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

  const wonTrophies = trophies.filter((t) => isWinnerPlace(t.place));

  // Dedupe injuries by player
  const injSeen = new Set<string>();
  const injuries = club.injuries
    .filter((i) => {
      const key = i.playerId || i.id;
      if (injSeen.has(key)) return false;
      injSeen.add(key);
      return true;
    })
    .map((i) => ({
      id: i.id,
      status: i.status,
      injuryType: i.injuryType,
      expectedReturn: i.expectedReturn,
      playerId: i.playerId,
      playerName: i.player?.name || "—",
      shirtNumber: i.player?.shirtNumber ?? null,
    }));

  return NextResponse.json({
    club: {
      id: club.id,
      name: club.name,
      shortName: club.shortName,
      abbreviation: club.abbreviation,
      primaryColor: club.primaryColor,
      secondaryColor: club.secondaryColor,
      founded: club.founded ?? afTeam?.team?.founded ?? null,
      city: club.city || afTeam?.venue?.city || null,
      stadiumName: club.stadiumName || afTeam?.venue?.name || null,
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
      age: resolvePersonAge(pl),
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
      age: resolvePersonAge(c),
      role: c.role,
      photoUrl: c.photoUrl,
    })),
    afCoach: coach
      ? {
          id: coach.id,
          name: coach.name,
          nationality: coach.nationality,
          age: resolvePersonAge(coach),
          photo: coach.photo,
          career: (coach.career || []).slice(0, 8),
        }
      : null,
    formerCoaches,
    injuries,
    notes,
    transfers,
    trophies,
    wonTrophies,
    standingsRow,
    schedule,
    competitions,
    afStub,
  });
}
