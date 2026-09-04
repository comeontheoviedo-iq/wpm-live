import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isGeminiConfigured } from "@/lib/gemini";
import { PACK_TEMPLATE_SEEDS } from "@/lib/pack-templates";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let templates = await prisma.packTemplate.findMany({ orderBy: { order: "asc" } });
  if (templates.length === 0) {
    // fallback to in-code seeds if DB not seeded
    templates = PACK_TEMPLATE_SEEDS.map((t) => ({
      id: `seed-${t.key}`,
      ...t,
      description: t.description,
    })) as typeof templates;
  }

  const sections = await prisma.packSection.findMany({
    where: { matchId: id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    templates,
    sections,
    gemini: isGeminiConfigured(),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const templateKey = String(body.templateKey || "");
  const content = String(body.content ?? "");
  if (!templateKey) {
    return NextResponse.json({ error: "templateKey required" }, { status: 400 });
  }
  const title = String(body.title || templateKey);
  const section = await prisma.packSection.upsert({
    where: { matchId_templateKey: { matchId: id, templateKey } },
    create: {
      matchId: id,
      templateKey,
      title,
      content,
      status: "edited",
    },
    update: { content, title, status: "edited" },
  });
  return NextResponse.json({ section });
}
