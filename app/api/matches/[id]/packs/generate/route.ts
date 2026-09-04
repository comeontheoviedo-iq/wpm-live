import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import {
  PACK_TEMPLATE_SEEDS,
  buildMatchContextPrompt,
} from "@/lib/pack-templates";
import { broadcastLabelFor } from "@/lib/competitions";
import { formatKickoff } from "@/lib/utils";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const templateKey = String(body.templateKey || "");
  if (!templateKey) {
    return NextResponse.json({ error: "templateKey required" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeClub: { include: { players: true } },
      awayClub: { include: { players: true } },
      matchDay: true,
      venue: true,
      notes: true,
      officials: { include: { official: true } },
    },
  });
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let template = await prisma.packTemplate.findUnique({ where: { key: templateKey } });
  if (!template) {
    const seed = PACK_TEMPLATE_SEEDS.find((t) => t.key === templateKey);
    if (!seed) return NextResponse.json({ error: "Unknown template" }, { status: 404 });
    template = {
      id: `seed-${seed.key}`,
      key: seed.key,
      title: seed.title,
      description: seed.description,
      section: seed.section,
      prompt: seed.prompt,
      order: seed.order,
    };
  }

  const homeXi = match.homeClub.players
    .filter((p) => p.isStarter)
    .map((p) => `#${p.shirtNumber} ${p.name}`);
  const awayXi = match.awayClub.players
    .filter((p) => p.isStarter)
    .map((p) => `#${p.shirtNumber} ${p.name}`);
  const referee = match.officials.find((o) => o.role === "Referee")?.official.name;

  const ctx = buildMatchContextPrompt({
    home: match.homeClub.name,
    away: match.awayClub.name,
    competition: match.matchDay.competition,
    broadcastCompetition: broadcastLabelFor(match.matchDay.competition),
    kickoff: formatKickoff(match.kickoff),
    venue: match.venue?.name,
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
    lineupStatus: match.lineupStatus,
    referee,
    homeXi,
    awayXi,
    notes: match.notes.map((n) => `${n.title}: ${n.body}`),
  });

  const result = await generateWithGemini(
    "You are Pitchline, a football commentary prep assistant.",
    `${template.prompt}\n\nMATCH CONTEXT:\n${ctx}`
  );

  const section = await prisma.packSection.upsert({
    where: { matchId_templateKey: { matchId: id, templateKey } },
    create: {
      matchId: id,
      templateKey,
      title: template.title,
      content: result.text,
      status: result.stub ? "draft" : "generated",
    },
    update: {
      title: template.title,
      content: result.text,
      status: result.stub ? "draft" : "generated",
    },
  });

  // Persist useful outputs into Scripts / Notes / Hooks
  if (!result.stub) {
    if (templateKey === "intro" || templateKey === "lineup") {
      const timing = templateKey === "lineup" ? "kickoff" : "pre-match";
      const existing = await prisma.speak.findFirst({
        where: { matchId: id, title: template.title },
      });
      if (existing) {
        await prisma.speak.update({
          where: { id: existing.id },
          data: { body: result.text, timing },
        });
      } else {
        await prisma.speak.create({
          data: {
            matchId: id,
            userId: session.id,
            title: template.title,
            body: result.text,
            timing,
            order: templateKey === "lineup" ? 2 : 1,
          },
        });
      }
    }
    if (templateKey === "hooks") {
      await prisma.note.create({
        data: {
          matchId: id,
          userId: session.id,
          title: "Generated hooks & fillers",
          body: result.text,
          category: "Hook",
          entityType: "match",
          entityId: id,
          pinned: true,
        },
      });
    }
    if (templateKey === "research" || templateKey === "referee") {
      await prisma.note.create({
        data: {
          matchId: id,
          userId: session.id,
          title: template.title,
          body: result.text,
          category: templateKey === "referee" ? "Match" : "Match",
          entityType: "match",
          entityId: id,
        },
      });
    }
    if (templateKey === "profiles") {
      await prisma.note.create({
        data: {
          matchId: id,
          userId: session.id,
          title: "Player profiles pack",
          body: result.text,
          category: "Bio",
          entityType: "match",
          entityId: id,
        },
      });
    }
  }

  return NextResponse.json({
    section,
    stub: result.stub,
    gemini: isGeminiConfigured(),
    model: result.model,
  });
}
