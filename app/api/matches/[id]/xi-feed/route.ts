import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";
import { sendOwnerXiWrongAlert } from "@/lib/owner-xi-wrong-alert";

/**
 * PATCH /api/matches/[id]/xi-feed
 * Body: { action: "lock" | "unlock" | "report_wrong", note?: string, playerId?: string, lockPlayer?: boolean }
 *
 * lock / report_wrong → freeze Official/Predicted/Last XI feed apply (events/score still sync)
 * unlock → desk owner only
 * lockPlayer → per-player MatchPlayerOverride.lockFromFeed
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: matchId } = await params;
  const owned = await assertMatchOwned(matchId, session);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeClub: { select: { shortName: true, name: true } },
      awayClub: { select: { shortName: true, name: true } },
      matchDay: { select: { competition: true, userId: true } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = match.matchDay.userId === session.id;

  if (action === "lockPlayer" || action === "unlockPlayer") {
    const playerId = String(body.playerId || "").trim();
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 });
    }
    const lockFromFeed = action === "lockPlayer";
    const row = await prisma.matchPlayerOverride.upsert({
      where: { matchId_playerId: { matchId, playerId } },
      create: { matchId, playerId, lockFromFeed },
      update: { lockFromFeed },
    });
    return NextResponse.json({ ok: true, override: row });
  }

  if (action === "lock") {
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        xiFeedFrozen: true,
        xiFeedFrozenAt: new Date(),
        xiFeedFrozenByUserId: session.id,
        xiFeedFrozenReason: "lock",
        xiFeedFrozenNote: body.note ? String(body.note).slice(0, 500) : null,
      },
    });
    return NextResponse.json({
      ok: true,
      xiFeedFrozen: updated.xiFeedFrozen,
      xiFeedFrozenReason: updated.xiFeedFrozenReason,
      xiFeedFrozenAt: updated.xiFeedFrozenAt,
    });
  }

  if (action === "report_wrong") {
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const frozenAt = new Date();
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        xiFeedFrozen: true,
        xiFeedFrozenAt: frozenAt,
        xiFeedFrozenByUserId: session.id,
        xiFeedFrozenReason: "looks_wrong",
        xiFeedFrozenNote: note,
      },
    });

    const title = `${match.homeClub.shortName} vs ${match.awayClub.shortName}`;
    void sendOwnerXiWrongAlert({
      reporterName: session.name || "",
      reporterEmail: session.email || "",
      matchId,
      matchTitle: title,
      competition: match.matchDay.competition,
      afFixtureId: match.apiFootballFixtureId,
      note,
      frozenAt,
    });

    return NextResponse.json({
      ok: true,
      xiFeedFrozen: updated.xiFeedFrozen,
      xiFeedFrozenReason: updated.xiFeedFrozenReason,
      xiFeedFrozenAt: updated.xiFeedFrozenAt,
      alertQueued: true,
    });
  }

  if (action === "unlock") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the desk owner can unlock feed sync" },
        { status: 403 }
      );
    }
    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        xiFeedFrozen: false,
        xiFeedFrozenAt: null,
        xiFeedFrozenByUserId: null,
        xiFeedFrozenReason: null,
        xiFeedFrozenNote: null,
      },
    });
    return NextResponse.json({
      ok: true,
      xiFeedFrozen: updated.xiFeedFrozen,
    });
  }

  return NextResponse.json(
    { error: "action must be lock | unlock | report_wrong | lockPlayer | unlockPlayer" },
    { status: 400 }
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: matchId } = await params;
  const owned = await assertMatchOwned(matchId, session);
  if (!owned.ok) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      xiFeedFrozen: true,
      xiFeedFrozenAt: true,
      xiFeedFrozenByUserId: true,
      xiFeedFrozenReason: true,
      xiFeedFrozenNote: true,
      lineupSource: true,
      lineupSourceMeta: true,
      lineupStatus: true,
      apiFootballFixtureId: true,
      kickoff: true,
      matchDay: { select: { competition: true, userId: true } },
      homeClub: { select: { apiFootballTeamId: true, shortName: true } },
      awayClub: { select: { apiFootballTeamId: true, shortName: true } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...match,
    isOwner: match.matchDay.userId === session.id,
  });
}
