import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Manual override of a player's formation slot / on-pitch state when feed lags. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await params; // match id available for auth scoping later
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId || "");
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if ("formationSlot" in body) data.formationSlot = body.formationSlot;
  if ("isStarter" in body) data.isStarter = Boolean(body.isStarter);
  if ("onPitch" in body) data.onPitch = Boolean(body.onPitch);
  if ("shirtNumber" in body) data.shirtNumber = Number(body.shirtNumber);

  const player = await prisma.player.update({ where: { id: playerId }, data });

  if (body.homeFormation || body.awayFormation || body.lineupStatus) {
    const { id } = await params;
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
