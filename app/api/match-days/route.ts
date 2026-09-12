import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { DEFAULT_CHECKLIST, DEFAULT_SCRIPT_SLOTS } from "@/lib/defaults";
import { ensureClub, parseAfTeamId } from "@/lib/ensure-club";
import { getFixture, assertFixtureCompatible } from "@/lib/api-football";
import { leagueIdForCompetition } from "@/lib/competitions";
import { assertCanCreateDesk } from "@/lib/trial";

function sanitizeCreateError(e: unknown): { status: number; error: string } {
  if (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code?: string }).code === "string"
  ) {
    const code = (e as { code: string }).code;
    if (code === "P2002") {
      return { status: 409, error: "Fixture already linked to another desk" };
    }
    if (code === "P2003") {
      return {
        status: 400,
        error:
          "Could not create match desk — a related record is missing. Sign in again and re-select the teams.",
      };
    }
  }
  console.error(
    "[POST /api/match-days]",
    e instanceof Error ? e.message : String(e)
  );
  return {
    status: 500,
    error: "Could not create match desk. Please try again.",
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Tenancy: personal accounts only see desks they own (demo = demo@pitchline.app userId).
  const matchDays = await prisma.matchDay.findMany({
    where: { userId: session.id },
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

  // Stale JWT after DB reseed → MatchDay.userId FK P2003 (exact UI dump)
  const dbUser = await prisma.user.findUnique({ where: { id: session.id } });
  if (!dbUser) {
    return NextResponse.json(
      { error: "Session expired — please sign in again" },
      { status: 401 }
    );
  }

  const deskGate = await assertCanCreateDesk(session.id);
  if (!deskGate.ok) {
    return NextResponse.json(
      { error: deskGate.error, trial: deskGate.snapshot },
      { status: deskGate.status }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));

    const competition = String(body.competition || "").trim();
    const homeClubId = String(body.homeClubId || "").trim();
    const awayClubId = String(body.awayClubId || "").trim();
    const kickoffRaw = body.kickoff;
    if (!competition || !kickoffRaw) {
      return NextResponse.json(
        { error: "competition and kickoff required" },
        { status: 400 }
      );
    }

    const homeAf = parseAfTeamId(
      body.homeApiFootballTeamId ?? body.homeAfTeamId
    );
    const awayAf = parseAfTeamId(
      body.awayApiFootballTeamId ?? body.awayAfTeamId
    );
    const homeName = String(body.homeTeamName || body.homeName || "").trim();
    const awayName = String(body.awayTeamName || body.awayName || "").trim();

    if (!homeClubId && homeAf === null && !homeName) {
      return NextResponse.json(
        { error: "homeClubId or home live-feed team required" },
        { status: 400 }
      );
    }
    if (!awayClubId && awayAf === null && !awayName) {
      return NextResponse.json(
        { error: "awayClubId or away live-feed team required" },
        { status: 400 }
      );
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

    if (apiFootballFixtureId !== null && !Number.isNaN(apiFootballFixtureId)) {
      const existing = await prisma.match.findFirst({
        where: { apiFootballFixtureId },
        select: {
          id: true,
          matchDayId: true,
          matchDay: { select: { userId: true } },
        },
      });
      if (existing) {
        const mine = existing.matchDay.userId === session.id;
        return NextResponse.json(
          mine
            ? {
                error: "Fixture already linked",
                matchId: existing.id,
                matchDayId: existing.matchDayId,
              }
            : { error: "Fixture already linked to another account" },
          { status: 409 }
        );
      }

      // Refuse wrong-league / wrong-team attaches at create time
      try {
        const fx = await getFixture(apiFootballFixtureId);
        if (!fx) {
          return NextResponse.json(
            { error: `Live-feed fixture #${apiFootballFixtureId} not found` },
            { status: 400 }
          );
        }
        const expectedLeague = leagueIdForCompetition(competition);
        const compat = assertFixtureCompatible({
          fixture: fx,
          homeAfId: homeAf,
          awayAfId: awayAf,
          leagueId: expectedLeague,
        });
        if (!compat.ok) {
          return NextResponse.json(
            { error: compat.reason || "Fixture does not match selected clubs/competition" },
            { status: 400 }
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fixture lookup failed";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const home = await ensureClub(tx, {
        id: homeClubId || null,
        name: homeName || null,
        shortName: body.homeShortName || null,
        apiFootballTeamId: homeAf,
      });
      const away = await ensureClub(tx, {
        id: awayClubId || null,
        name: awayName || null,
        shortName: body.awayShortName || null,
        apiFootballTeamId: awayAf,
      });

      if (!home || !away) {
        throw Object.assign(new Error("CLUB_NOT_FOUND"), { code: "CLUB_NOT_FOUND" });
      }
      if (home.id === away.id) {
        throw Object.assign(new Error("TEAMS_SAME"), { code: "TEAMS_SAME" });
      }

      const title =
        String(body.title || "").trim() ||
        `${home.shortName} vs ${away.shortName}`;

      const matchDay = await tx.matchDay.create({
        data: {
          title,
          date: kickoff,
          competition,
          userId: dbUser.id,
          status: "upcoming",
        },
      });

      const match = await tx.match.create({
        data: {
          matchDayId: matchDay.id,
          homeClubId: home.id,
          awayClubId: away.id,
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
          userId: dbUser.id,
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

      return { matchDay, match, home, away };
    });

    return NextResponse.json(result);
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "CLUB_NOT_FOUND"
    ) {
      return NextResponse.json(
        { error: "Club not found — re-select teams from the fixture list" },
        { status: 404 }
      );
    }
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "TEAMS_SAME"
    ) {
      return NextResponse.json({ error: "Teams must differ" }, { status: 400 });
    }
    const { status, error } = sanitizeCreateError(e);
    return NextResponse.json({ error }, { status });
  }
}
