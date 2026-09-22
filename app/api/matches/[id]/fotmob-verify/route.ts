import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";
import {
  buildVerifyResult,
  fetchFotMobMatchDetails,
  isActiveCommentaryDesk,
  resolveFotMobMatchId,
  withinFotMobPollWindow,
} from "@/lib/fotmob-lineup";
import {
  parseLineupSourceMeta,
  resolveLineupSourceKind,
} from "@/lib/lineup-source";

/**
 * GET /api/matches/[id]/fotmob-verify
 * Silent FotMob XI status for prep/live desks. Soft-fails on blocks.
 */
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
    include: {
      homeClub: { select: { id: true, name: true, shortName: true } },
      awayClub: { select: { id: true, name: true, shortName: true } },
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deskActive = isActiveCommentaryDesk(match.status);
  const meta = parseLineupSourceMeta(match.lineupSourceMeta);
  const ourKind = resolveLineupSourceKind({
    lineupSource: match.lineupSource,
    lineupStatus: match.lineupStatus,
    matchStatus: match.status,
    meta,
  });

  const [homePlayers, awayPlayers] = await Promise.all([
    prisma.player.findMany({
      where: {
        clubId: match.homeClubId,
        OR: [{ isStarter: true }, { onPitch: true }],
        NOT: { formationSlot: "BENCH" },
      },
      select: { name: true },
    }),
    prisma.player.findMany({
      where: {
        clubId: match.awayClubId,
        OR: [{ isStarter: true }, { onPitch: true }],
        NOT: { formationSlot: "BENCH" },
      },
      select: { name: true },
    }),
  ]);

  if (!deskActive || !withinFotMobPollWindow(match.kickoff)) {
    const result = buildVerifyResult({
      deskActive,
      kickoff: match.kickoff,
      ourLineupSourceKind: ourKind,
      ourHomeStarters: homePlayers.map((p) => p.name),
      ourAwayStarters: awayPlayers.map((p) => p.name),
      ourHomeFormation: match.homeFormation,
      ourAwayFormation: match.awayFormation,
      fotmob: null,
      fotmobMatchId: match.fotmobMatchId,
    });
    return NextResponse.json(result);
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
    const result = buildVerifyResult({
      deskActive,
      kickoff: match.kickoff,
      ourLineupSourceKind: ourKind,
      ourHomeStarters: homePlayers.map((p) => p.name),
      ourAwayStarters: awayPlayers.map((p) => p.name),
      ourHomeFormation: match.homeFormation,
      ourAwayFormation: match.awayFormation,
      fotmob: null,
      fotmobMatchId: match.fotmobMatchId,
      error: resolved.error,
    });
    return NextResponse.json(result);
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

  const fetched = await fetchFotMobMatchDetails(resolved.fotmobMatchId);
  if (!fetched.ok) {
    const result = buildVerifyResult({
      deskActive,
      kickoff: match.kickoff,
      ourLineupSourceKind: ourKind,
      ourHomeStarters: homePlayers.map((p) => p.name),
      ourAwayStarters: awayPlayers.map((p) => p.name),
      ourHomeFormation: match.homeFormation,
      ourAwayFormation: match.awayFormation,
      fotmob: null,
      fotmobMatchId: resolved.fotmobMatchId,
      error: fetched.error,
    });
    return NextResponse.json(result);
  }

  const result = buildVerifyResult({
    deskActive,
    kickoff: match.kickoff,
    ourLineupSourceKind: ourKind,
    ourHomeStarters: homePlayers.map((p) => p.name),
    ourAwayStarters: awayPlayers.map((p) => p.name),
    ourHomeFormation: match.homeFormation,
    ourAwayFormation: match.awayFormation,
    fotmob: fetched.lineup,
    fotmobMatchId: resolved.fotmobMatchId,
  });
  return NextResponse.json(result);
}
