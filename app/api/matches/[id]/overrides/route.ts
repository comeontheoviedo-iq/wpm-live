import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
 * Body: { playerId, displayName?, pronunciation?, pitchFlag?, jerseyNumber?, clear?: boolean }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: matchId } = await params;
  const body = await req.json().catch(() => ({}));
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

  const data = {
    displayName: cleanStr(body.displayName, 64),
    pronunciation: cleanStr(body.pronunciation, 120),
    pitchFlag: cleanFlag(body.pitchFlag),
    jerseyNumber: cleanJersey(body.jerseyNumber),
  };

  // If all empty, delete
  if (
    !data.displayName &&
    !data.pronunciation &&
    !data.pitchFlag &&
    data.jerseyNumber == null
  ) {
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
