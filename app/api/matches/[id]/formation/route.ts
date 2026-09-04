import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FORMATIONS, slotsFor } from "@/lib/formations";
import { remapStartersToFormation } from "@/lib/api-football";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const side = body.side === "away" ? "away" : body.side === "home" ? "home" : null;
    const formation = String(body.formation || "");
    if (!side) {
      return NextResponse.json({ error: "side must be home|away" }, { status: 400 });
    }
    if (!formation || !FORMATIONS[formation]) {
      return NextResponse.json(
        { error: `Unknown formation. Use one of: ${Object.keys(FORMATIONS).join(", ")}` },
        { status: 400 }
      );
    }

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const clubId = side === "home" ? match.homeClubId : match.awayClubId;
    const starters = await prisma.player.findMany({
      where: { clubId, OR: [{ isStarter: true }, { onPitch: true }] },
      select: { id: true, formationSlot: true, position: true, name: true },
    });

    const mapped = remapStartersToFormation(starters, formation);
    const valid = new Set(slotsFor(formation).map((s) => s.id));

    await prisma.player.updateMany({
      where: { clubId },
      data: { isStarter: false, onPitch: false, formationSlot: null },
    });

    for (const m of mapped) {
      if (!valid.has(m.formationSlot)) continue;
      await prisma.player.update({
        where: { id: m.playerId },
        data: {
          isStarter: true,
          onPitch: true,
          formationSlot: m.formationSlot,
        },
      });
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        ...(side === "home"
          ? { homeFormation: formation }
          : { awayFormation: formation }),
      },
    });

    const after = await prisma.player.findMany({
      where: { clubId, isStarter: true },
      select: { name: true, formationSlot: true, shirtNumber: true },
      orderBy: { shirtNumber: "asc" },
    });

    return NextResponse.json({
      match: updated,
      side,
      formation,
      mapping: after.map((p) => ({
        name: p.name,
        slot: p.formationSlot,
        n: p.shirtNumber,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
