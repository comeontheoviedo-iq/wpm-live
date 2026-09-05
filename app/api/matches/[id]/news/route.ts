import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMatchNews, type NewsMatchContext } from "@/lib/news";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const force =
    searchParams.get("refresh") === "1" || searchParams.get("force") === "1";
  // RSS-first: brief off by default. Pass brief=1 to enrich / Gemini.
  const brief = searchParams.get("brief") === "1";

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      matchDay: true,
      homeClub: {
        include: {
          players: {
            select: {
              id: true,
              name: true,
              isStarter: true,
              onPitch: true,
              clubId: true,
            },
          },
        },
      },
      awayClub: {
        include: {
          players: {
            select: {
              id: true,
              name: true,
              isStarter: true,
              onPitch: true,
              clubId: true,
            },
          },
        },
      },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const competition = match.matchDay?.competition || "";

  const players: NewsMatchContext["players"] = [
    ...match.homeClub.players.map((p) => ({
      id: p.id,
      name: p.name,
      side: "home" as const,
      isStarter: p.isStarter || p.onPitch,
    })),
    ...match.awayClub.players.map((p) => ({
      id: p.id,
      name: p.name,
      side: "away" as const,
      isStarter: p.isStarter || p.onPitch,
    })),
  ];

  const ctx: NewsMatchContext = {
    matchId: match.id,
    competition,
    homeClub: {
      id: match.homeClub.id,
      name: match.homeClub.name,
      shortName: match.homeClub.shortName || match.homeClub.name,
    },
    awayClub: {
      id: match.awayClub.id,
      name: match.awayClub.name,
      shortName: match.awayClub.shortName || match.awayClub.name,
    },
    players,
  };

  try {
    const payload = await getMatchNews(ctx, { force, brief });
    const headers: Record<string, string> = {
      "Cache-Control": "private, max-age=0, must-revalidate",
    };
    if (payload.stale) headers["X-News-Stale"] = "1";
    if (!payload.briefIncluded) headers["X-News-Brief"] = "pending";
    return NextResponse.json(payload, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "News fetch failed",
        matchId: id,
        items: [],
        feeds: [],
        warnings: ["News pipeline error"],
        gemini: { configured: false, used: false, pending: false },
        briefIncluded: false,
        fetchedAt: new Date().toISOString(),
        cached: false,
        cacheTtlMs: 0,
      },
      { status: 500 }
    );
  }
}
