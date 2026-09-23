import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";
import { sendOwnerXiWrongAlert } from "@/lib/owner-xi-wrong-alert";
import { sendSupportPingAlert } from "@/lib/support-ping-alert";
import { syncMatchFromApiFootball } from "@/lib/sync-fixture";
import { isApiFootballConfigured } from "@/lib/api-football";
import {
  BLANK_CANVAS_FREEZE_REASON,
  stringifyLineupSourceMeta,
  type LineupSourceMeta,
} from "@/lib/lineup-source";
import { clearAllPitchPlacements } from "@/lib/pitch-placement";

async function countStarters(matchId: string): Promise<number> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeClubId: true, awayClubId: true },
  });
  if (!match) return 0;
  return prisma.player.count({
    where: {
      clubId: { in: [match.homeClubId, match.awayClubId] },
      OR: [{ isStarter: true }, { onPitch: true }],
      NOT: { formationSlot: "BENCH" },
    },
  });
}

/**
 * PATCH /api/matches/[id]/xi-feed
 * Body: { action: "lock" | "unlock" | "report_wrong" | "repull_official" | "blank_canvas" | "blank_canvas", note?: string, playerId?: string, lockPlayer?: boolean }
 *
 * lock / report_wrong → freeze Official/Predicted/Last XI feed apply (events/score still sync)
 * blank_canvas → clear pitch slots, set Manual source, freeze feed (squad list kept)
 * unlock → desk owner only (blank_canvas: any desk member may unlock)
 * repull_official → owner only: unlock freeze + forced Official lineup re-apply
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

    // Also write SupportPing so Ask/Report pickup routine sees it
    let supportPingId: string | null = null;
    try {
      const message =
        note?.trim() ||
        `XI looks wrong reported on ${title}. Official feed sync frozen. Does not re-pull — owner should Re-pull Official XI.`;
      const ping = await prisma.supportPing.create({
        data: {
          userId: session.id,
          type: "xi_wrong",
          message: message.slice(0, 8000),
          context: JSON.stringify({
            matchTitle: title,
            matchId,
            afFixtureId: match.apiFootballFixtureId,
            lineupSource: match.lineupSource,
            competition: match.matchDay.competition,
            status: match.status,
            frozenAt: frozenAt.toISOString(),
            source: "report_wrong",
          }),
          status: "open",
        },
        select: { id: true, createdAt: true },
      });
      supportPingId = ping.id;
      void sendSupportPingAlert({
        pingId: ping.id,
        type: "xi_wrong",
        message,
        userName: session.name || "",
        userEmail: session.email || "",
        context: {
          matchTitle: title,
          matchId,
          afFixtureId: match.apiFootballFixtureId,
          lineupSource: match.lineupSource,
          competition: match.matchDay.competition,
          status: match.status,
        },
        createdAt: ping.createdAt,
      });
    } catch (e) {
      console.warn(
        "[xi-feed] SupportPing create failed",
        e instanceof Error ? e.message : e
      );
    }

    return NextResponse.json({
      ok: true,
      xiFeedFrozen: updated.xiFeedFrozen,
      xiFeedFrozenReason: updated.xiFeedFrozenReason,
      xiFeedFrozenAt: updated.xiFeedFrozenAt,
      alertQueued: true,
      supportPingId,
    });
  }


  if (action === "blank_canvas") {
    const now = new Date();
    const note = body.note ? String(body.note).slice(0, 500) : null;

    // Clear pitch for both clubs — keep squad rows available for placement.
    await prisma.player.updateMany({
      where: { clubId: { in: [match.homeClubId, match.awayClubId] } },
      data: { isStarter: false, onPitch: false, formationSlot: null },
    });
    await clearAllPitchPlacements(matchId);

    const prevMeta = (() => {
      try {
        return match.lineupSourceMeta
          ? (JSON.parse(match.lineupSourceMeta) as LineupSourceMeta)
          : {};
      } catch {
        return {} as LineupSourceMeta;
      }
    })();
    const nextMeta: LineupSourceMeta = {
      ...prevMeta,
      blankCanvasAt: now.toISOString(),
      liveAfterSubs: false,
      warning: "Blank canvas — Manual XI. Feed frozen until Unlock & pull.",
    };

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        xiFeedFrozen: true,
        xiFeedFrozenAt: now,
        xiFeedFrozenByUserId: session.id,
        xiFeedFrozenReason: BLANK_CANVAS_FREEZE_REASON,
        xiFeedFrozenNote: note || "Blank canvas / Manual XI",
        lineupSource: "manual",
        lineupStatus: "expected",
        lineupSourceMeta: stringifyLineupSourceMeta(nextMeta),
        predictedHomeJson: null,
        predictedAwayJson: null,
      },
    });

    return NextResponse.json({
      ok: true,
      blankCanvas: true,
      xiFeedFrozen: updated.xiFeedFrozen,
      xiFeedFrozenReason: updated.xiFeedFrozenReason,
      xiFeedFrozenAt: updated.xiFeedFrozenAt,
      lineupSource: updated.lineupSource,
      lineupStatus: updated.lineupStatus,
    });
  }

  if (action === "unlock") {
    const blankCanvas =
      match.xiFeedFrozenReason === BLANK_CANVAS_FREEZE_REASON;
    if (!isOwner && !blankCanvas) {
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

  if (action === "repull_official") {
    if (!isOwner) {
      return NextResponse.json(
        { error: "Only the desk owner can Re-pull Official XI" },
        { status: 403 }
      );
    }
    if (!isApiFootballConfigured()) {
      return NextResponse.json(
        { error: "API_FOOTBALL_KEY is not set" },
        { status: 503 }
      );
    }
    if (!match.apiFootballFixtureId) {
      return NextResponse.json(
        { error: "Match has no AF fixture linked" },
        { status: 400 }
      );
    }

    const beforeStarters = await countStarters(matchId);

    // Unlock freeze first so subsequent polls can also apply
    await prisma.match.update({
      where: { id: matchId },
      data: {
        xiFeedFrozen: false,
        xiFeedFrozenAt: null,
        xiFeedFrozenByUserId: null,
        xiFeedFrozenReason: null,
        xiFeedFrozenNote: null,
      },
    });

    let syncResult: Awaited<ReturnType<typeof syncMatchFromApiFootball>>;
    try {
      syncResult = await syncMatchFromApiFootball(matchId, {
        mode: "full",
        forceOfficialLineup: true,
        resetPlacements: true,
      });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e || "Sync failed");
      console.error("[xi-feed/repull_official]", raw);
      return NextResponse.json(
        { error: raw.length <= 160 ? raw : "Re-pull Official failed" },
        { status: 400 }
      );
    }

    const afterStarters = await countStarters(matchId);
    const lineupApplied =
      syncResult.lineupStatus === "confirmed" ||
      (syncResult.lineupCount ?? 0) > 0;

    return NextResponse.json({
      ok: true,
      xiFeedFrozen: false,
      lineupApplied,
      lineupStatus: syncResult.lineupStatus,
      previousLineupStatus: syncResult.previousLineupStatus,
      before: { starters: beforeStarters },
      after: { starters: afterStarters },
    });
  }

  return NextResponse.json(
    {
      error:
        "action must be lock | unlock | report_wrong | repull_official | blank_canvas | lockPlayer | unlockPlayer",
    },
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
