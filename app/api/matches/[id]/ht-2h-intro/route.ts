import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildHt2hIntroScript } from "@/lib/ht-2h-intro";

/**
 * Generate factual 2nd-half intro into Scripts (Speak timing half-time)
 * + PackSection templateKey ht_2h_intro. Co-pilot tone; no invention.
 */
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
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const homeName = match.homeClub.shortName || match.homeClub.name;
  const awayName = match.awayClub.shortName || match.awayClub.name;
  const script = buildHt2hIntroScript({
    homeName,
    awayName,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    competition: match.matchDay.competition,
    events: match.events.map((e) => ({
      type: e.type,
      minute: e.minute,
      description: e.description,
      teamSide: e.teamSide,
    })),
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
  });

  const title = `2nd half intro · ${homeName} ${match.homeScore}–${match.awayScore} ${awayName}`;
  let saved = false;

  try {
    // Scripts UI is Speaks with timings — use half-time bucket (Scripts, not Speaks branding in UI)
    const existing = await prisma.speak.findFirst({
      where: {
        matchId: match.id,
        timing: "half-time",
        OR: [
          { title: { startsWith: "2nd half intro" } },
          { title: { startsWith: "2H intro" } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing && existing.status !== "edited") {
      await prisma.speak.update({
        where: { id: existing.id },
        data: { title, body: script, status: "generated" },
      });
    } else if (!existing) {
      await prisma.speak.create({
        data: {
          matchId: match.id,
          userId: session.id,
          title,
          body: script,
          timing: "half-time",
          status: "generated",
          order: 0,
        },
      });
    } else {
      // User edited — create a fresh generated sibling rather than overwrite
      await prisma.speak.create({
        data: {
          matchId: match.id,
          userId: session.id,
          title: `${title} (regen)`,
          body: script,
          timing: "half-time",
          status: "generated",
          order: existing.order + 1,
        },
      });
    }

    await prisma.packSection.upsert({
      where: {
        matchId_templateKey: {
          matchId: match.id,
          templateKey: "ht_2h_intro",
        },
      },
      create: {
        matchId: match.id,
        templateKey: "ht_2h_intro",
        title: "2nd half intro",
        content: script,
        status: "ready",
      },
      update: {
        content: script,
        title: "2nd half intro",
        status: "ready",
      },
    });
    saved = true;
  } catch (err) {
    console.error("[ht-2h-intro] save soft-fail", err);
  }

  return NextResponse.json({ script, saved, title });
}
