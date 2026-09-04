import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const clubs = await prisma.club.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { shortName: { contains: q } },
            { abbreviation: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 50,
  });
  return NextResponse.json({ clubs });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const afTeamIdRaw = body.apiFootballTeamId;
    const afTeamId =
      afTeamIdRaw === null || afTeamIdRaw === undefined || afTeamIdRaw === ""
        ? null
        : Number(afTeamIdRaw);

    if (afTeamId !== null && !Number.isNaN(afTeamId)) {
      const byAf = await prisma.club.findFirst({
        where: { apiFootballTeamId: afTeamId },
      });
      if (byAf) {
        // Keep name in sync lightly if missing AF link already existed under same id
        return NextResponse.json({ club: byAf, existing: true });
      }
    }

    const byName = await prisma.club.findFirst({
      where: { name: { equals: name } },
    });
    if (byName) {
      if (
        afTeamId !== null &&
        !Number.isNaN(afTeamId) &&
        byName.apiFootballTeamId == null
      ) {
        const updated = await prisma.club.update({
          where: { id: byName.id },
          data: { apiFootballTeamId: afTeamId },
        });
        return NextResponse.json({ club: updated, existing: true });
      }
      return NextResponse.json({ club: byName, existing: true });
    }

    const shortName = String(body.shortName || name).trim();
    const abbreviation = String(
      body.abbreviation || shortName.slice(0, 3).toUpperCase()
    );

    try {
      const club = await prisma.club.create({
        data: {
          name,
          shortName,
          abbreviation,
          primaryColor: body.primaryColor || "#0d9488",
          secondaryColor: body.secondaryColor || "#f0fdfa",
          badgeEmoji: body.badgeEmoji || "⚽",
          city: body.city || null,
          apiFootballTeamId:
            afTeamId !== null && !Number.isNaN(afTeamId) ? afTeamId : null,
        },
      });
      return NextResponse.json({ club });
    } catch (e) {
      // Unique conflict (or race): fetch existing by AF id or name
      const msg = e instanceof Error ? e.message : String(e);
      if (afTeamId !== null && !Number.isNaN(afTeamId)) {
        const existing = await prisma.club.findFirst({
          where: { apiFootballTeamId: afTeamId },
        });
        if (existing) return NextResponse.json({ club: existing, existing: true });
      }
      const existingByName = await prisma.club.findFirst({
        where: { name: { equals: name } },
      });
      if (existingByName) {
        return NextResponse.json({ club: existingByName, existing: true });
      }
      console.error("[POST /api/clubs]", msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/clubs]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
