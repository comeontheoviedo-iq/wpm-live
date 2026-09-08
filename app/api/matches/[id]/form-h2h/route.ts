import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leagueIdForCompetition } from "@/lib/competitions";
import { europeanSeasonYear } from "@/lib/season";
import {
  getStandings,
  isApiFootballConfigured,
} from "@/lib/api-football";

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
      matchDay: true,
      homeClub: true,
      awayClub: true,
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const base = {
    homeForm: null as string | null,
    awayForm: null as string | null,
    homeRank: null as number | null,
    awayRank: null as number | null,
    h2h: match.h2hSummary || null,
    message: null as string | null,
  };

  if (!isApiFootballConfigured()) {
    return NextResponse.json({
      ...base,
      message: "Live feed not configured — showing desk H2H only",
    });
  }

  const leagueId = leagueIdForCompetition(match.matchDay.competition);
  if (!leagueId) {
    return NextResponse.json({
      ...base,
      message: "No league id for competition — H2H from desk only",
    });
  }

  try {
    const season = europeanSeasonYear(match.kickoff);
    const rows = await getStandings(leagueId, season);
    const table = rows?.[0]?.league?.standings?.[0] || [];
    const homeAf = match.homeClub.apiFootballTeamId;
    const awayAf = match.awayClub.apiFootballTeamId;
    const homeRow = table.find((r) => r.team.id === homeAf);
    const awayRow = table.find((r) => r.team.id === awayAf);

    return NextResponse.json({
      homeForm: homeRow?.form || null,
      awayForm: awayRow?.form || null,
      homeRank: homeRow?.rank ?? null,
      awayRank: awayRow?.rank ?? null,
      h2h: match.h2hSummary || null,
      message: null,
    });
  } catch (e) {
    return NextResponse.json({
      ...base,
      message: e instanceof Error ? e.message : "Standings soft-failed",
    });
  }
}
