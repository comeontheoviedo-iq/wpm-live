import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PACK_TEMPLATE_SEEDS } from "@/lib/pack-templates";
import { applyPackDistribution } from "@/lib/pack-distribute-apply";
import { formatDistributeSummary } from "@/lib/pack-distribute";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const templateKey = String(body.templateKey || "").trim();
    if (!templateKey) {
      return NextResponse.json(
        { error: "Pick a pack section first, then Send to desk notes." },
        { status: 400 }
      );
    }

    const seed = PACK_TEMPLATE_SEEDS.find((t) => t.key === templateKey);
    const label = seed?.title || templateKey;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeClub: {
          include: {
            players: { select: { id: true, name: true } },
            coaches: { select: { id: true, name: true, clubId: true } },
          },
        },
        awayClub: {
          include: {
            players: { select: { id: true, name: true } },
            coaches: { select: { id: true, name: true, clubId: true } },
          },
        },
      },
    });
    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const existing = await prisma.packSection.findUnique({
      where: { matchId_templateKey: { matchId: id, templateKey } },
    });

    // Prefer live draft from the client so Save is not required before Send
    const draftContent =
      typeof body.content === "string" ? body.content.trim() : "";
    const content = draftContent || existing?.content?.trim() || "";

    if (!content) {
      return NextResponse.json(
        {
          error: `No content for “${label}” yet — Generate or paste first.`,
          templateKey,
          code: "EMPTY_SECTION",
        },
        { status: 404 }
      );
    }

    const title = existing?.title || seed?.title || templateKey;
    const section = await prisma.packSection.upsert({
      where: { matchId_templateKey: { matchId: id, templateKey } },
      create: {
        matchId: id,
        templateKey,
        title,
        content,
        status: existing?.status || "draft",
      },
      update: {
        content,
        title,
      },
    });

    const allPlayers = [
      ...match.homeClub.players.map((p) => ({ id: p.id, name: p.name })),
      ...match.awayClub.players.map((p) => ({ id: p.id, name: p.name })),
    ];
    const coaches = [
      ...match.homeClub.coaches.map((c) => ({
        id: c.id,
        name: c.name,
        clubId: c.clubId,
        side: "home" as const,
      })),
      ...match.awayClub.coaches.map((c) => ({
        id: c.id,
        name: c.name,
        clubId: c.clubId,
        side: "away" as const,
      })),
    ];

    const distributed = await applyPackDistribution({
      matchId: id,
      userId: session.id,
      templateKey,
      templateTitle: section.title || title,
      content: section.content,
      homeClub: { id: match.homeClub.id, name: match.homeClub.name },
      awayClub: { id: match.awayClub.id, name: match.awayClub.name },
      allPlayers,
      coaches,
    });

    const total =
      (distributed.scripts || 0) +
      (distributed.playerNotes || 0) +
      (distributed.clubNotes || 0) +
      (distributed.matchNotes || 0) +
      (distributed.coachNotes || 0) +
      (distributed.hookNotes || 0);
    const summary = formatDistributeSummary(distributed);

    return NextResponse.json({
      ok: true,
      templateKey,
      title: section.title || title,
      contentLength: section.content.length,
      distributed,
      summary,
      emptyDistribution: total === 0,
      message:
        total === 0
          ? `“${label}” was saved but nothing mapped into Scripts/Notes (check headings).`
          : `Organised “${label}” → ${summary}.`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
