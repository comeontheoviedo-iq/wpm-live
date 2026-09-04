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

  try {
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

    const fixtureIdRaw = body.apiFootballFixtureId;
    const apiFootballFixtureId =
      fixtureIdRaw === null || fixtureIdRaw === undefined || fixtureIdRaw === ""
        ? null
        : Number(fixtureIdRaw);

    // Not @unique in schema, but prevent accidental duplicate desks for same fixture
    if (apiFootballFixtureId !== null && !Number.isNaN(apiFootballFixtureId)) {
      const existing = await prisma.match.findFirst({
        where: { apiFootballFixtureId },
        select: { id: true, matchDayId: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            error: "Fixture already linked",
            matchId: existing.id,
            matchDayId: existing.matchDayId,
          },
          { status: 409 }
        );
      }
    }

    const title =
      String(body.title || "").trim() ||
      `${home.shortName} vs ${away.shortName}`;

    const result = await prisma.$transaction(async (tx) => {
      const matchDay = await tx.matchDay.create({
        data: {
          title,
          date: kickoff,
          competition,
          userId: session.id,
          status: "upcoming",
        },
      });

      const match = await tx.match.create({
        data: {
          matchDayId: matchDay.id,
          homeClubId,
          awayClubId,
          kickoff,
          status: "Assigned",
          featured: Boolean(body.featured),
          apiFootballFixtureId:
            apiFootballFixtureId !== null && !Number.isNaN(apiFootballFixtureId)
              ? apiFootballFixtureId
              : null,
          homeFormation: body.homeFormation || "4-3-3",
          awayFormation: body.awayFormation || "4-2-3-1",
          weatherSummary: body.weatherSummary || null,
        },
      });

      await tx.checklistItem.createMany({
        data: DEFAULT_CHECKLIST.map((c) => ({
          ...c,
          matchId: match.id,
          done: false,
        })),
      });

      await tx.speak.createMany({
        data: DEFAULT_SCRIPT_SLOTS.map((s) => ({
          ...s,
          matchId: match.id,
          userId: session.id,
        })),
      });

      await tx.statistic.createMany({
        data: [
          {
            matchId: match.id,
            label: "Possession",
            homeValue: "—",
            awayValue: "—",
            order: 1,
          },
          {
            matchId: match.id,
            label: "Shots",
            homeValue: "0",
            awayValue: "0",
            order: 2,
          },
          {
            matchId: match.id,
            label: "Shots on target",
            homeValue: "0",
            awayValue: "0",
            order: 3,
          },
          {
            matchId: match.id,
            label: "Corners",
            homeValue: "0",
            awayValue: "0",
            order: 4,
          },
          {
            matchId: match.id,
            label: "Fouls",
            homeValue: "0",
            awayValue: "0",
            order: 5,
          },
          {
            matchId: match.id,
            label: "Yellow cards",
            homeValue: "0",
            awayValue: "0",
            order: 6,
          },
        ],
      });

      return { matchDay, match };
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/match-days]", msg);
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Fixture already linked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
