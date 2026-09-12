import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampPitchCoord } from "@/lib/player-overrides";
import {
  clearAllPitchPlacements,
  mirrorAllFreePlaceCoords,
  upsertPitchPlacement,
} from "@/lib/pitch-placement";

function cleanStr(v: unknown, max = 120): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function cleanFlag(v: unknown): string | null {
  const s = cleanStr(v, 64);
  if (!s) return null;
  const low = s.toLowerCase();
  if (["primary", "secondary", "both", "first", "second", "dual"].includes(low)) {
    return low === "first" ? "primary" : low === "second" ? "secondary" : low === "dual" ? "both" : low;
  }
  return s;
}

function cleanJersey(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 0 || i > 99) return null;
  return i;
}

/** GET all match-scoped player overrides for a desk. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await prisma.matchPlayerOverride.findMany({
    where: { matchId: id },
  });
  return NextResponse.json({ overrides: rows });
}

/**
 * PATCH upsert one player override.
 * Body: { playerId, displayName?, pronunciation?, pitchFlag?, jerseyNumber?,
 *         formationSlot?, pitchX?, pitchY?, clear?: boolean, clearPlacements?: boolean,
 *         mirrorFreePlace?: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: matchId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.clearPlacements === true && !body.playerId) {
    const r = await clearAllPitchPlacements(matchId);
    return NextResponse.json({ clearedPlacements: r.cleared });
  }

  if (body.mirrorFreePlace === true && !body.playerId) {
    const r = await mirrorAllFreePlaceCoords(matchId);
    return NextResponse.json({ mirrored: r.mirrored });
  }

  const playerId = String(body.playerId || "").trim();
  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      homeClubId: true,
      awayClubId: true,
    },
  });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { id: true, clubId: true },
  });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (player.clubId !== match.homeClubId && player.clubId !== match.awayClubId) {
    return NextResponse.json({ error: "Player not in this match" }, { status: 400 });
  }

  if (body.clear === true) {
    await prisma.matchPlayerOverride.deleteMany({
      where: { matchId, playerId },
    });
    return NextResponse.json({ override: null, cleared: true });
  }

  if (body.clearPlacement === true) {
    const override = await upsertPitchPlacement({
      matchId,
      playerId,
      clearPlacement: true,
    });
    return NextResponse.json({ override, clearedPlacement: true });
  }

  const hasPlacementKeys =
    "formationSlot" in body || "pitchX" in body || "pitchY" in body;
  if (hasPlacementKeys && !("displayName" in body) && !("pronunciation" in body) && !("pitchFlag" in body) && !("jerseyNumber" in body)) {
    const override = await upsertPitchPlacement({
      matchId,
      playerId,
      formationSlot: body.formationSlot,
      pitchX: body.pitchX,
      pitchY: body.pitchY,
    });
    return NextResponse.json({ override });
  }

  const existing = await prisma.matchPlayerOverride.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });

  const data = {
    displayName:
      "displayName" in body ? cleanStr(body.displayName, 64) : existing?.displayName ?? null,
    pronunciation:
      "pronunciation" in body
        ? cleanStr(body.pronunciation, 120)
        : existing?.pronunciation ?? null,
    pitchFlag:
      "pitchFlag" in body ? cleanFlag(body.pitchFlag) : existing?.pitchFlag ?? null,
    jerseyNumber:
      "jerseyNumber" in body
        ? cleanJersey(body.jerseyNumber)
        : existing?.jerseyNumber ?? null,
    formationSlot:
      "formationSlot" in body
        ? body.formationSlot
          ? String(body.formationSlot).slice(0, 32)
          : null
        : existing?.formationSlot ?? null,
    pitchX:
      "pitchX" in body ? clampPitchCoord(body.pitchX) : existing?.pitchX ?? null,
    pitchY:
      "pitchY" in body ? clampPitchCoord(body.pitchY) : existing?.pitchY ?? null,
  };

  const empty =
    !data.displayName &&
    !data.pronunciation &&
    !data.pitchFlag &&
    data.jerseyNumber == null &&
    !data.formationSlot &&
    data.pitchX == null &&
    data.pitchY == null;

  if (empty) {
    await prisma.matchPlayerOverride.deleteMany({ where: { matchId, playerId } });
    return NextResponse.json({ override: null, cleared: true });
  }

  const override = await prisma.matchPlayerOverride.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: { matchId, playerId, ...data },
    update: data,
  });
  return NextResponse.json({ override });
}
