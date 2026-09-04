import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const type = String(body.type || "note");
  const minute = Number(body.minute ?? 0);
  const playerId = body.playerId || null;
  const teamSide = body.teamSide || null;
  const description = String(body.description || type);
  const commentary = body.commentary ? String(body.commentary) : null;

  const event = await prisma.matchEvent.create({
    data: {
      matchId: id,
      type,
      minute,
      playerId,
      teamSide,
      description,
      commentary,
    },
  });

  const scoreTypes = ["goal", "penalty_goal"];
  if (scoreTypes.includes(type) && teamSide) {
    await prisma.match.update({
      where: { id },
      data:
        teamSide === "home"
          ? { homeScore: { increment: 1 }, minute }
          : { awayScore: { increment: 1 }, minute },
    });
  } else if (type === "own_goal" && teamSide) {
    // own goal credits the other side
    await prisma.match.update({
      where: { id },
      data:
        teamSide === "home"
          ? { awayScore: { increment: 1 }, minute }
          : { homeScore: { increment: 1 }, minute },
    });
  } else {
    await prisma.match.update({ where: { id }, data: { minute } });
  }

  if (type === "halftime") {
    await prisma.match.update({
      where: { id },
      data: { period: "HT", minute: 45 },
    });
  }

  return NextResponse.json({ event });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const events = await prisma.matchEvent.findMany({
    where: { matchId: id },
    orderBy: [{ minute: "desc" }, { createdAt: "desc" }],
    include: { player: true },
  });
  return NextResponse.json({ events });
}
