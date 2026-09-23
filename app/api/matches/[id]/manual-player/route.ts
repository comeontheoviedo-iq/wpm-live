import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertMatchOwned } from "@/lib/tenancy";

/**
 * POST /api/matches/[id]/manual-player
 * Body: { side: "home" | "away", name: string, shirtNumber?: number, position?: string }
 *
 * For Blank canvas / thin squads: create (or reuse) a club player by name so
 * commentators can place typed / DB roster names onto the Manual XI.
 */
export async function POST(
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
  const side = body.side === "away" ? "away" : body.side === "home" ? "home" : null;
  const name = String(body.name || "").trim().slice(0, 80);
  if (!side || !name) {
    return NextResponse.json(
      { error: "side (home|away) and name required" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeClubId: true, awayClubId: true },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const clubId = side === "home" ? match.homeClubId : match.awayClubId;

  let shirtNumber: number | null = null;
  if (body.shirtNumber != null && body.shirtNumber !== "") {
    const n = Number(body.shirtNumber);
    if (Number.isFinite(n)) shirtNumber = Math.max(0, Math.min(99, Math.round(n)));
  }
  const position = body.position
    ? String(body.position).trim().slice(0, 32)
    : "MID";

  // Prefer an existing club player with same name (case-insensitive).
  const existing = await prisma.player.findFirst({
    where: {
      clubId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (existing) {
    const data: { shirtNumber?: number; position?: string } = {};
    if (shirtNumber != null && existing.shirtNumber !== shirtNumber) {
      data.shirtNumber = shirtNumber;
    }
    if (position && existing.position !== position) {
      data.position = position;
    }
    const player =
      Object.keys(data).length > 0
        ? await prisma.player.update({ where: { id: existing.id }, data })
        : existing;
    return NextResponse.json({ ok: true, player, created: false });
  }

  // Pick a free shirt number if none given.
  if (shirtNumber == null) {
    const taken = new Set(
      (
        await prisma.player.findMany({
          where: { clubId },
          select: { shirtNumber: true },
        })
      ).map((p) => p.shirtNumber)
    );
    let n = 40;
    while (taken.has(n) && n < 99) n += 1;
    shirtNumber = taken.has(n) ? 99 : n;
  }

  const player = await prisma.player.create({
    data: {
      clubId,
      name,
      shirtNumber,
      position: position || "MID",
      nationality: "UNK",
      isStarter: false,
      onPitch: false,
      formationSlot: null,
    },
  });


  return NextResponse.json({ ok: true, player, created: true });
}
