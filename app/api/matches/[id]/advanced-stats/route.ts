import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveAdvancedMatchStats } from "@/lib/advanced-stats";
import { xgFromAfStatistics } from "@/lib/xg-alt";

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

    // Soft merge: AF fixture statistics sometimes include expected_goals
    if (!stats.available || stats.homeXg == null) {
      try {
        const rows = await prisma.statistic.findMany({ where: { matchId: match.id } });
        const mapped = rows.map((r) => ({
          label: r.label,
          homeValue: r.homeValue,
          awayValue: r.awayValue,
        }));
        const afXg = xgFromAfStatistics(mapped);
        if (afXg) {
          return NextResponse.json({
            ...stats,
            available: true,
            source: stats.source || "advanced",
            sourceLabel: "Advanced stats",
            homeXg: afXg.homeXg,
            awayXg: afXg.awayXg,
            homeXga: afXg.awayXg,
            awayXga: afXg.homeXg,
            message: null,
            shots: stats.shots || [],
          });
        }
      } catch {
        /* soft */
      }
    }

    return NextResponse.json({
      ...stats,
      sourceLabel: "Advanced stats",
      shots: stats.shots || [],
    });
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
        shots: [],
      },
      { status: 200 }
    );
  }
}
