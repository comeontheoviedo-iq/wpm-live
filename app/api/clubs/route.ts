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
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const shortName = String(body.shortName || name).trim();
  const abbreviation = String(body.abbreviation || shortName.slice(0, 3).toUpperCase());
  const club = await prisma.club.create({
    data: {
      name,
      shortName,
      abbreviation,
      primaryColor: body.primaryColor || "#0d9488",
      secondaryColor: body.secondaryColor || "#f0fdfa",
      badgeEmoji: body.badgeEmoji || "⚽",
      city: body.city || null,
      apiFootballTeamId: body.apiFootballTeamId || null,
    },
  });
  return NextResponse.json({ club });
}
