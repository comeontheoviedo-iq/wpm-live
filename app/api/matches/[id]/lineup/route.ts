import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savePredictedLineup, snapshotPredictedSide } from "@/lib/sync-fixture";

/** Manual override / DnD predicted XI slot assignment. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Bulk predicted XI from desk DnD
  if (body.side && Array.isArray(body.slots)) {
    try {
      const match = await savePredictedLineup(
        id,
        body.side === "away" ? "away" : "home",
        body.slots.map((s: { playerId: string; formationSlot: string }) => ({
          playerId: String(s.playerId),
          formationSlot: String(s.formationSlot),
        })),
        body.formation ? String(body.formation) : undefined
      );
      return NextResponse.json({ match, lineupStatus: match.lineupStatus });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Save failed" },
        { status: 400 }
      );
    }
  }

  // Place / clear a single player on a slot (DnD drop)
  if (body.action === "place" || body.action === "clear") {
    const match = await prisma.match.findUnique({ where: { id } });
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (match.lineupStatus === "confirmed") {
      return NextResponse.json(
        { error: "Official lineups locked" },
        { status: 409 }
      );
    }

    const playerId = String(body.playerId || "");
    if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

    const side =
      player.clubId === match.homeClubId
        ? "home"
        : player.clubId === match.awayClubId
          ? "away"
          : null;
    if (!side) {
      return NextResponse.json({ error: "Player not in this match" }, { status: 400 });
    }

    if (body.action === "clear") {
      await prisma.player.update({
        where: { id: playerId },
        data: { isStarter: false, onPitch: false, formationSlot: null },
      });
    } else {
      const slot = String(body.formationSlot || "");
      if (!slot) {
        return NextResponse.json({ error: "formationSlot required" }, { status: 400 });
      }
      // Vacate anyone already in this slot on the same club
      await prisma.player.updateMany({
        where: { clubId: player.clubId, formationSlot: slot, NOT: { id: playerId } },
        data: { isStarter: false, onPitch: false, formationSlot: null },
      });
      await prisma.player.update({
        where: { id: playerId },
        data: { isStarter: true, onPitch: true, formationSlot: slot },
      });
    }

    const json = await snapshotPredictedSide(
      side === "home" ? match.homeClubId : match.awayClubId
    );
    const updated = await prisma.match.update({
      where: { id },
      data: {
        lineupStatus: "predicted",
        ...(side === "home" ? { predictedHomeJson: json } : { predictedAwayJson: json }),
        ...(body.formation
          ? side === "home"
            ? { homeFormation: String(body.formation) }
            : { awayFormation: String(body.formation) }
          : {}),
      },
    });

    const refreshed = await prisma.player.findUnique({ where: { id: playerId } });
    return NextResponse.json({ player: refreshed, match: updated });
  }

  // Legacy single-field patch
  const playerId = String(body.playerId || "");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if ("formationSlot" in body) data.formationSlot = body.formationSlot;
  if ("isStarter" in body) data.isStarter = Boolean(body.isStarter);
  if ("onPitch" in body) data.onPitch = Boolean(body.onPitch);
  if ("shirtNumber" in body) data.shirtNumber = Number(body.shirtNumber);

  const player = await prisma.player.update({ where: { id: playerId }, data });

  if (body.homeFormation || body.awayFormation || body.lineupStatus) {
    await prisma.match.update({
      where: { id },
      data: {
        ...(body.homeFormation ? { homeFormation: String(body.homeFormation) } : {}),
        ...(body.awayFormation ? { awayFormation: String(body.awayFormation) } : {}),
        ...(body.lineupStatus ? { lineupStatus: String(body.lineupStatus) } : {}),
      },
    });
  }

  return NextResponse.json({ player });
}
