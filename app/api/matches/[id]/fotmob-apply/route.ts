import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";
import {
  FOTMOB_FEED_FREEZE_REASON,
  buildVerifyResult,
  fetchFotMobMatchDetails,
  isActiveCommentaryDesk,
  mapFotMobStartersToClubPlayers,
  resolveFotMobMatchId,
  withinFotMobApplyWindow,
} from "@/lib/fotmob-lineup";
import {
  BLANK_CANVAS_FREEZE_REASON,
  parseLineupSourceMeta,
  resolveLineupSourceKind,
  stringifyLineupSourceMeta,
} from "@/lib/lineup-source";

const MIN_MAPPED_PER_SIDE = 9;

/**
 * POST /api/matches/[id]/fotmob-apply
 * One-tap import of confirmed FotMob Official XI.
 * Gates (server): active desk + T−30…KO + FotMob confirmed Official.
 * Never auto-called — explicit user click only.
 *
 * Freeze choice: set xiFeedFrozen reason=fotmob_apply so pre-KO AF sync
 * cannot fallback_last_xi over the applied board. Unlock / Re-pull clears it.
 */
export async function POST(
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
    include: {
      homeClub: { select: { id: true, name: true, shortName: true } },
      awayClub: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isActiveCommentaryDesk(match.status)) {
    return NextResponse.json(
      { error: "Apply only on prep/live desks", code: "desk_inactive" },
      { status: 400 }
    );
  }
  if (
    match.xiFeedFrozen &&
    (match.xiFeedFrozenReason === BLANK_CANVAS_FREEZE_REASON ||
      match.lineupSource === "manual")
  ) {
    return NextResponse.json(
      {
        error:
          "Blank canvas / Manual XI is active — Unlock & pull before applying FotMob XI",
        code: "blank_canvas_frozen",
      },
      { status: 409 }
    );
  }
  if (!withinFotMobApplyWindow(match.kickoff)) {
    return NextResponse.json(
      {
        error: "Apply only within 30 minutes of kickoff (before KO)",
        code: "outside_apply_window",
      },
      { status: 400 }
    );
  }

  const resolved = await resolveFotMobMatchId({
    homeName: match.homeClub.name,
    awayName: match.awayClub.name,
    homeShortName: match.homeClub.shortName,
    awayShortName: match.awayClub.shortName,
    kickoff: match.kickoff,
    cachedId: match.fotmobMatchId,
  });
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error, code: "fotmob_unresolved" },
      { status: 502 }
    );
  }

  if (
    resolved.resolvedVia === "date_search" &&
    resolved.fotmobMatchId !== match.fotmobMatchId
  ) {
    await prisma.match
      .update({
        where: { id: matchId },
        data: { fotmobMatchId: resolved.fotmobMatchId },
      })
      .catch(() => null);
  }

  const fetched = await fetchFotMobMatchDetails(resolved.fotmobMatchId, {
    bypassCache: true,
  });
  if (!fetched.ok) {
    return NextResponse.json(
      { error: fetched.error, code: "fotmob_unavailable" },
      { status: 502 }
    );
  }
  if (fetched.lineup.classification !== "confirmed") {
    return NextResponse.json(
      {
        error: "FotMob XI is not confirmed Official yet",
        code: "fotmob_not_confirmed",
        classification: fetched.lineup.classification,
        lineupType: fetched.lineup.lineupType,
        source: fetched.lineup.source,
      },
      { status: 400 }
    );
  }

  const [homeSquad, awaySquad] = await Promise.all([
    prisma.player.findMany({
      where: { clubId: match.homeClubId },
      select: { id: true, name: true, shirtNumber: true },
    }),
    prisma.player.findMany({
      where: { clubId: match.awayClubId },
      select: { id: true, name: true, shirtNumber: true },
    }),
  ]);

  const homeMap = mapFotMobStartersToClubPlayers({
    starters: fetched.lineup.home.starters,
    formation: fetched.lineup.home.formation,
    fallbackFormation: match.homeFormation || "4-3-3",
    clubPlayers: homeSquad,
  });
  const awayMap = mapFotMobStartersToClubPlayers({
    starters: fetched.lineup.away.starters,
    formation: fetched.lineup.away.formation,
    fallbackFormation: match.awayFormation || "4-2-3-1",
    clubPlayers: awaySquad,
  });

  if (
    homeMap.mapped.length < MIN_MAPPED_PER_SIDE ||
    awayMap.mapped.length < MIN_MAPPED_PER_SIDE
  ) {
    return NextResponse.json(
      {
        error: "Too many unmapped FotMob starters — will not invent AF ids",
        code: "too_many_unmapped",
        home: {
          mapped: homeMap.mapped,
          unmapped: homeMap.unmapped,
          formation: homeMap.formation,
        },
        away: {
          mapped: awayMap.mapped,
          unmapped: awayMap.unmapped,
          formation: awayMap.formation,
        },
      },
      { status: 422 }
    );
  }

  const appliedAt = new Date();
  const homeKept = new Set(homeMap.mapped.map((m) => m.playerId));
  const awayKept = new Set(awayMap.mapped.map((m) => m.playerId));

  // Place mapped starters
  for (const row of homeMap.mapped) {
    await prisma.player.update({
      where: { id: row.playerId },
      data: {
        isStarter: true,
        onPitch: true,
        formationSlot: row.formationSlot,
        ...(row.shirtNumber != null ? { shirtNumber: row.shirtNumber } : {}),
      },
    });
  }
  for (const row of awayMap.mapped) {
    await prisma.player.update({
      where: { id: row.playerId },
      data: {
        isStarter: true,
        onPitch: true,
        formationSlot: row.formationSlot,
        ...(row.shirtNumber != null ? { shirtNumber: row.shirtNumber } : {}),
      },
    });
  }

  // Clear prior XI flags for anyone not in mapped sets
  await prisma.player.updateMany({
    where: {
      clubId: match.homeClubId,
      id: { notIn: [...homeKept] },
      OR: [{ isStarter: true }, { onPitch: true }, { formationSlot: { not: null } }],
    },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });
  await prisma.player.updateMany({
    where: {
      clubId: match.awayClubId,
      id: { notIn: [...awayKept] },
      OR: [{ isStarter: true }, { onPitch: true }, { formationSlot: { not: null } }],
    },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });

  const prevMeta = parseLineupSourceMeta(match.lineupSourceMeta) || {};
  const nextMeta = {
    ...prevMeta,
    officialCapturedAt: appliedAt.toISOString(),
    homeStarters: homeMap.mapped.length,
    awayStarters: awayMap.mapped.length,
    fotmobAppliedAt: appliedAt.toISOString(),
    fotmobMatchId: resolved.fotmobMatchId,
    fotmobApplySource: "fotmob",
    fotmobLineupType: fetched.lineup.lineupType,
    fotmobSource: fetched.lineup.source,
    liveAfterSubs: false,
    emptySlotWarning:
      homeMap.unmapped.length || awayMap.unmapped.length
        ? `Unmapped FotMob starters: home ${homeMap.unmapped.length}, away ${awayMap.unmapped.length}`
        : null,
  };

  await prisma.match.update({
    where: { id: matchId },
    data: {
      homeFormation: homeMap.formation,
      awayFormation: awayMap.formation,
      lineupStatus: "confirmed",
      lineupSource: "official",
      lineupSourceMeta: stringifyLineupSourceMeta(nextMeta),
      fotmobMatchId: resolved.fotmobMatchId,
      lastFeedSyncAt: appliedAt,
      // Freeze AF overwrite until Unlock / Re-pull Official
      xiFeedFrozen: true,
      xiFeedFrozenAt: appliedAt,
      xiFeedFrozenByUserId: session.id,
      xiFeedFrozenReason: FOTMOB_FEED_FREEZE_REASON,
      xiFeedFrozenNote: `FotMob Official apply ${appliedAt.toISOString()} (match ${resolved.fotmobMatchId})`,
    },
  });

  // Build post-apply verify snapshot for UI
  const meta = nextMeta;
  const ourKind = resolveLineupSourceKind({
    lineupSource: "official",
    lineupStatus: "confirmed",
    matchStatus: match.status,
    meta,
  });
  const verify = buildVerifyResult({
    deskActive: true,
    kickoff: match.kickoff,
    ourLineupSourceKind: ourKind,
    ourHomeStarters: homeMap.mapped.map((m) => m.playerName),
    ourAwayStarters: awayMap.mapped.map((m) => m.playerName),
    ourHomeFormation: homeMap.formation,
    ourAwayFormation: awayMap.formation,
    fotmob: fetched.lineup,
    fotmobMatchId: resolved.fotmobMatchId,
  });

  return NextResponse.json({
    ok: true,
    fotmobMatchId: resolved.fotmobMatchId,
    appliedAt: appliedAt.toISOString(),
    lineupStatus: "confirmed",
    lineupSource: "official",
    xiFeedFrozen: true,
    xiFeedFrozenReason: FOTMOB_FEED_FREEZE_REASON,
    home: {
      mapped: homeMap.mapped,
      unmapped: homeMap.unmapped,
      formation: homeMap.formation,
    },
    away: {
      mapped: awayMap.mapped,
      unmapped: awayMap.unmapped,
      formation: awayMap.formation,
    },
    verify,
  });
}
