import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PACK_TEMPLATE_SEEDS } from "@/lib/pack-templates";
import { applyPackDistribution } from "@/lib/pack-distribute-apply";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const templateKey = String(body.templateKey || "");
    if (!templateKey) {
      return NextResponse.json({ error: "templateKey required" }, { status: 400 });
    }

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        homeClub: { include: { players: { select: { id: true, name: true } } } },
        awayClub: { include: { players: { select: { id: true, name: true } } } },
      },
    });
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const section = await prisma.packSection.findUnique({
      where: { matchId_templateKey: { matchId: id, templateKey } },
    });
    if (!section?.content?.trim()) {
      return NextResponse.json(
        { error: "No pack content for this section — Generate first." },
        { status: 404 }
      );
    }

    const seed = PACK_TEMPLATE_SEEDS.find((t) => t.key === templateKey);
    const title = section.title || seed?.title || templateKey;

    const allPlayers = [
      ...match.homeClub.players.map((p) => ({ id: p.id, name: p.name })),
      ...match.awayClub.players.map((p) => ({ id: p.id, name: p.name })),
    ];

    const distributed = await applyPackDistribution({
      matchId: id,
      userId: session.id,
      templateKey,
      templateTitle: title,
      content: section.content,
      homeClub: { id: match.homeClub.id, name: match.homeClub.name },
      awayClub: { id: match.awayClub.id, name: match.awayClub.name },
      allPlayers,
    });

    return NextResponse.json({ ok: true, templateKey, distributed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
