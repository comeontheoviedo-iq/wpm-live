import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getEvents,
  getFixture,
  isApiFootballConfigured,
  ApiFootballError,
} from "@/lib/api-football";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isApiFootballConfigured())
    return NextResponse.json(
      { error: "Live feed not configured" },
      { status: 400 }
    );

  const { id } = await params;
  const fixtureId = Number(id);
  if (!Number.isFinite(fixtureId))
    return NextResponse.json({ error: "Invalid fixture id" }, { status: 400 });

  try {
    const [fx, events] = await Promise.all([
      getFixture(fixtureId),
      getEvents(fixtureId).catch(() => []),
    ]);
    if (!fx)
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

    const goals = (events || [])
      .filter((e) => /goal/i.test(e.type || "") || /goal/i.test(e.detail || ""))
      .map((e) => ({
        minute: e.time?.elapsed ?? null,
        extra: e.time?.extra ?? null,
        team: e.team?.name || null,
        teamId: e.team?.id ?? null,
        player: e.player?.name || null,
        assist: e.assist?.name || null,
        detail: e.detail || e.type || null,
      }));

    return NextResponse.json({
      fixture: {
        id: fx.fixture.id,
        date: fx.fixture.date,
        status: fx.fixture.status?.short || "",
        statusLong: fx.fixture.status?.long || "",
        elapsed: fx.fixture.status?.elapsed ?? null,
        venue: fx.fixture.venue || null,
        referee: fx.fixture.referee || null,
      },
      league: fx.league
        ? {
            id: fx.league.id,
            name: fx.league.name,
            country: fx.league.country,
            round: fx.league.round,
            logo: (fx.league as { logo?: string }).logo ?? null,
          }
        : null,
      teams: {
        home: {
          id: fx.teams.home.id,
          name: fx.teams.home.name,
          logo: fx.teams.home.logo,
        },
        away: {
          id: fx.teams.away.id,
          name: fx.teams.away.name,
          logo: fx.teams.away.logo,
        },
      },
      goals: {
        home: fx.goals?.home ?? null,
        away: fx.goals?.away ?? null,
      },
      score: fx.score || null,
      scorers: goals,
      eventCount: (events || []).length,
    });
  } catch (e) {
    const msg =
      e instanceof ApiFootballError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
