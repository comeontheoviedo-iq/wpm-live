import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { europeanSeasonYear } from "@/lib/season";
import { getPlayerById } from "@/lib/api-football";

function parseCm(h?: string | null) {
  if (!h) return null;
  const m = String(h).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function parseKg(w?: string | null) {
  if (!w) return null;
  const m = String(w).match(/(\d+)/);
  return m ? Number(m[1]) : null;
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

  let player = await prisma.player.findUnique({
    where: { id },
    include: {
      club: true,
      scorers: { orderBy: { rank: "asc" }, take: 5 },
      keepers: { orderBy: { rank: "asc" }, take: 5 },
    },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = matchId
    ? await prisma.note.findMany({
        where: {
          matchId,
          entityId: id,
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      })
    : await prisma.note.findMany({
        where: { entityId: id },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      });

  const injuries = await prisma.injury.findMany({
    where: {
      playerId: id,
      ...(matchId ? { OR: [{ matchId }, { matchId: null }] } : {}),
    },
    orderBy: { injuryType: "asc" },
    take: 8,
  });

  const events = matchId
    ? await prisma.matchEvent.findMany({
        where: {
          matchId,
          OR: [
            { playerId: id },
            { description: { contains: player.name } },
          ],
        },
        orderBy: [{ minute: "desc" }, { createdAt: "desc" }],
        take: 30,
      })
    : [];

  let afStats: unknown = null;
  let afStub: string | null = null;
  if (player.apiFootballPlayerId) {
    try {
      const season = europeanSeasonYear(new Date());
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, rej) =>
            setTimeout(() => rej(new Error("AF player stats timeout")), ms)
          ),
        ]);
      let rows = await withTimeout(
        getPlayerById(player.apiFootballPlayerId, season),
        3500
      );
      if (!rows?.[0]) {
        rows = await withTimeout(
          getPlayerById(player.apiFootballPlayerId, season - 1),
          2500
        );
      }
      afStats = rows?.[0] || null;
      if (!afStats) {
        afStub = "No AF player season stats returned for this id/season.";
      } else {
        const row = rows[0] as {
          player?: {
            photo?: string;
            height?: string;
            weight?: string;
            nationality?: string;
            age?: number;
            birth?: { date?: string };
          };
          statistics?: {
            games?: {
              appearences?: number | null;
              rating?: string | number | null;
              position?: string | null;
            };
            goals?: {
              total?: number | null;
              assists?: number | null;
              saves?: number | null;
            };
          }[];
        };
        const patch: Record<string, unknown> = {};
        if (row.player?.photo && !player.photoUrl) patch.photoUrl = row.player.photo;
        const h = parseCm(row.player?.height);
        if (h && !player.heightCm) patch.heightCm = h;
        const w = parseKg(row.player?.weight);
        if (w && !player.weightKg) patch.weightKg = w;
        if (row.player?.birth?.date && !player.birthDate)
          patch.birthDate = row.player.birth.date;
        if (row.player?.nationality && (!player.nationality || player.nationality === "ENG" || player.nationality === "UNK"))
          patch.nationality = row.player.nationality;
        if (row.player?.age && !player.age) patch.age = row.player.age;
        const af = row.statistics?.[0];
        const rt = af?.games?.rating;
        if (rt != null && rt !== "") {
          const n = Number(rt);
          if (Number.isFinite(n)) patch.rating = n;
        }
        if (af?.games?.appearences != null && !player.appearances)
          patch.appearances = af.games.appearences;
        if (af?.goals?.total != null && !player.goals) patch.goals = af.goals.total;
        if (af?.goals?.assists != null && !player.assists)
          patch.assists = af.goals.assists;
        if (Object.keys(patch).length) {
          player = await prisma.player.update({
            where: { id: player.id },
            data: patch,
            include: {
              club: true,
              scorers: { orderBy: { rank: "asc" }, take: 5 },
              keepers: { orderBy: { rank: "asc" }, take: 5 },
            },
          });
        }
      }
    } catch (e) {
      afStub =
        e instanceof Error
          ? `AF player stats unavailable: ${e.message}`
          : "AF player stats unavailable";
    }
  } else {
    afStub = "No apiFootballPlayerId linked — Sync squads first.";
  }

  const photoUrl =
    player.photoUrl ||
    (player.apiFootballPlayerId
      ? `https://media.api-sports.io/football/players/${player.apiFootballPlayerId}.png`
      : null);

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      shirtNumber: player.shirtNumber,
      position: player.position,
      nationality: player.nationality,
      age: player.age,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      birthDate: player.birthDate,
      photoUrl,
      preferredFoot: player.preferredFoot,
      isCaptain: player.isCaptain,
      goals: player.goals,
      assists: player.assists,
      appearances: player.appearances,
      cleanSheets: player.cleanSheets,
      yellowCards: player.yellowCards,
      redCards: player.redCards,
      rating: player.rating ?? null,
      apiFootballPlayerId: player.apiFootballPlayerId,
      club: {
        id: player.club.id,
        name: player.club.name,
        shortName: player.club.shortName,
        primaryColor: player.club.primaryColor,
      },
      seasonScorer: player.scorers[0] || null,
      seasonKeeper: player.keepers[0] || null,
    },
    notes,
    events,
    injuries: injuries.map((i) => ({
      id: i.id,
      status: i.status,
      injuryType: i.injuryType,
      expectedReturn: i.expectedReturn,
      notes: i.notes,
    })),
    afStats,
    afStub,
  });
}
