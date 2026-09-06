import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** OBS / talent-cam handoff — allow when clearly from overlay context. */
function isObsOverlayRequest(req: Request) {
  const referer = req.headers.get("referer") || "";
  const obsHeader = req.headers.get("x-pitchline-obs");
  const url = new URL(req.url);
  return (
    obsHeader === "1" ||
    referer.includes("/overlay") ||
    url.searchParams.get("obs") === "1"
  );
}

/**
 * Lightweight OBS / talent-cam handoff JSON.
 * GET /api/matches/:id/overlay
 *
 * Returns current scoreboard, XI (starters on pitch), and latest event flash.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session && !isObsOverlayRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      matchDay: true,
      homeClub: {
        include: {
          players: {
            where: { OR: [{ isStarter: true }, { onPitch: true }] },
            orderBy: { shirtNumber: "asc" },
          },
        },
      },
      awayClub: {
        include: {
          players: {
            where: { OR: [{ isStarter: true }, { onPitch: true }] },
            orderBy: { shirtNumber: "asc" },
          },
        },
      },
      events: { orderBy: [{ minute: "desc" }, { createdAt: "desc" }], take: 8 },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const slimPlayer = (p: {
    id: string;
    name: string;
    shirtNumber: number | null;
    position: string | null;
    formationSlot: string | null;
    onPitch: boolean;
    isStarter: boolean;
  }) => ({
    id: p.id,
    name: p.name,
    shirt: p.shirtNumber,
    position: p.position,
    slot: p.formationSlot,
    onPitch: p.onPitch,
    starter: p.isStarter,
  });

  const last = match.events[0] || null;

  const payload = {
    generatedAt: new Date().toISOString(),
    matchId: match.id,
    competition: match.matchDay.competition,
    status: match.status,
    minute: match.minute,
    scoreboard: {
      home: {
        name: match.homeClub.shortName || match.homeClub.name,
        score: match.homeScore,
        logo: match.homeClub.apiFootballTeamId
          ? `https://media.api-sports.io/football/teams/${match.homeClub.apiFootballTeamId}.png`
          : null,
      },
      away: {
        name: match.awayClub.shortName || match.awayClub.name,
        score: match.awayScore,
        logo: match.awayClub.apiFootballTeamId
          ? `https://media.api-sports.io/football/teams/${match.awayClub.apiFootballTeamId}.png`
          : null,
      },
    },
    xi: {
      home: match.homeClub.players.map(slimPlayer),
      away: match.awayClub.players.map(slimPlayer),
    },
    eventFlash: last
      ? {
          id: last.id,
          type: last.type,
          minute: last.minute,
          description: last.description,
          team: last.teamSide,
        }
      : null,
    recentEvents: match.events.map((e) => ({
      id: e.id,
      type: e.type,
      minute: e.minute,
      description: e.description,
      team: e.teamSide,
    })),
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
