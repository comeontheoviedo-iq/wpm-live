import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFtSummaryScript } from "@/lib/ft-summary";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      matchDay: true,
      homeClub: true,
      awayClub: true,
      events: { orderBy: [{ minute: "asc" }, { createdAt: "asc" }] },
      notes: {
        where: { OR: [{ pinned: true }, { category: "Hook" }] },
        take: 12,
      },
      officials: { include: { official: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const referee =
    match.officials.find((o) => o.role === "Referee")?.official?.name || null;

  const script = buildFtSummaryScript({
    homeName: match.homeClub.shortName || match.homeClub.name,
    awayName: match.awayClub.shortName || match.awayClub.name,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    competition: match.matchDay.competition,
    events: match.events.map((e) => ({
      type: e.type,
      minute: e.minute,
      description: e.description,
      team: e.teamSide,
    })),
    pinnedNotes: match.notes.map((n) => ({
      title: n.title,
      body: n.body,
      pinned: n.pinned,
      category: n.category,
    })),
    referee,
  });

  let saved = false;
  try {
    await prisma.speak.create({
      data: {
        matchId: match.id,
        userId: session.id,
        title: `FT summary · ${match.homeClub.shortName} ${match.homeScore}–${match.awayScore} ${match.awayClub.shortName}`,
        body: script,
        timing: "full-time",
      },
    });
    await prisma.packSection.upsert({
      where: {
        matchId_templateKey: {
          matchId: match.id,
          templateKey: "ft_summary",
        },
      },
      create: {
        matchId: match.id,
        templateKey: "ft_summary",
        title: "FT summary",
        content: script,
        status: "ready",
      },
      update: {
        content: script,
        status: "ready",
      },
    });
    saved = true;
  } catch (err) {
    console.error("[ft-summary] save soft-fail", err);
  }

  return NextResponse.json({ script, saved });
}
