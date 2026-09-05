import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAdvancedMatchStats } from "@/lib/advanced-stats";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeClub: true,
      awayClub: true,
      matchDay: true,
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const stats = await resolveAdvancedMatchStats({
      matchId: match.id,
      competition: match.matchDay.competition,
      homeName: match.homeClub.name,
      awayName: match.awayClub.name,
      kickoff: match.kickoff,
      status: match.status,
    });
    return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json(
      {
        available: false,
        source: null,
        sourceLabel: "xG",
        competition: match.matchDay.competition,
        coveredCompetition: false,
        message:
          e instanceof Error ? e.message : "xG temporarily unavailable",
        homeXg: null,
        awayXg: null,
        homeXga: null,
        awayXga: null,
        understatMatchId: null,
        matchedAt: null,
        forecast: null,
        shotSummary: null,
      },
      { status: 200 }
    );
  }
}
