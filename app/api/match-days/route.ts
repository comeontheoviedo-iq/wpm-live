import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DEFAULT_CHECKLIST, DEFAULT_SCRIPT_SLOTS } from "@/lib/defaults";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const matchDays = await prisma.matchDay.findMany({
    orderBy: { date: "desc" },
    include: {
      matches: {
        include: { homeClub: true, awayClub: true },
        orderBy: { kickoff: "asc" },
      },
    },
  });
  return NextResponse.json({ matchDays });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const competition = String(body.competition || "").trim();
  const homeClubId = String(body.homeClubId || "").trim();
  const awayClubId = String(body.awayClubId || "").trim();
  const kickoffRaw = body.kickoff;
  if (!competition || !homeClubId || !awayClubId || !kickoffRaw) {
    return NextResponse.json(
      { error: "competition, homeClubId, awayClubId, kickoff required" },
      { status: 400 }
    );
  }
  if (homeClubId === awayClubId) {
    return NextResponse.json({ error: "Teams must differ" }, { status: 400 });
  }

  const home = await prisma.club.findUnique({ where: { id: homeClubId } });
  const away = await prisma.club.findUnique({ where: { id: awayClubId } });
  if (!home || !away) {
    return NextResponse.json({ error: "Club not found" }, { status: 404 });
  }

  const kickoff = new Date(kickoffRaw);
  if (Number.isNaN(kickoff.getTime())) {
    return NextResponse.json({ error: "Invalid kickoff" }, { status: 400 });
  }

  const title =
    String(body.title || "").trim() ||
    `${home.shortName} vs ${away.shortName}`;

  const matchDay = await prisma.matchDay.create({
    data: {
      title,
      date: kickoff,
      competition,
      userId: session.id,
      status: "upcoming",
    },
  });

  const match = await prisma.match.create({
    data: {
      matchDayId: matchDay.id,
      homeClubId,
      awayClubId,
      kickoff,
      status: "Assigned",
      featured: Boolean(body.featured),
      apiFootballFixtureId: body.apiFootballFixtureId
        ? Number(body.apiFootballFixtureId)
        : null,
      homeFormation: body.homeFormation || "4-3-3",
      awayFormation: body.awayFormation || "4-2-3-1",
      weatherSummary: body.weatherSummary || null,
    },
  });

  for (const c of DEFAULT_CHECKLIST) {
    await prisma.checklistItem.create({
      data: { ...c, matchId: match.id, done: false },
    });
  }
  for (const s of DEFAULT_SCRIPT_SLOTS) {
    await prisma.speak.create({
      data: { ...s, matchId: match.id, userId: session.id },
    });
  }

  // default stats rows
  await prisma.statistic.createMany({
    data: [
      { matchId: match.id, label: "Possession", homeValue: "—", awayValue: "—", order: 1 },
      { matchId: match.id, label: "Shots", homeValue: "0", awayValue: "0", order: 2 },
      { matchId: match.id, label: "Shots on target", homeValue: "0", awayValue: "0", order: 3 },
      { matchId: match.id, label: "Corners", homeValue: "0", awayValue: "0", order: 4 },
      { matchId: match.id, label: "Fouls", homeValue: "0", awayValue: "0", order: 5 },
      { matchId: match.id, label: "Yellow cards", homeValue: "0", awayValue: "0", order: 6 },
    ],
  });

  return NextResponse.json({ matchDay, match });
}
