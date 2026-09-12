import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureClub, parseAfTeamId } from "@/lib/ensure-club";
import { displayText } from "@/lib/utils";

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
  return NextResponse.json({
    clubs: clubs.map((c) => ({
      ...c,
      name: displayText(c.name),
      shortName: displayText(c.shortName),
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const afTeamId = parseAfTeamId(body.apiFootballTeamId);
    const before =
      afTeamId !== null
        ? await prisma.club.findFirst({ where: { apiFootballTeamId: afTeamId } })
        : await prisma.club.findFirst({ where: { name: { equals: name } } });

    const club = await ensureClub(prisma, {
      name,
      shortName: body.shortName,
      abbreviation: body.abbreviation,
      apiFootballTeamId: afTeamId,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      badgeEmoji: body.badgeEmoji,
      city: body.city,
    });

    if (!club) {
      return NextResponse.json({ error: "Could not create club" }, { status: 500 });
    }

    return NextResponse.json({ club, existing: Boolean(before) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/clubs]", msg);
    return NextResponse.json(
      { error: "Could not save club. Please try again." },
      { status: 500 }
    );
  }
}
