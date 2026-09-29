import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";
import { applyPackDistribution } from "@/lib/pack-distribute-apply";
import { formatDistributeSummary } from "@/lib/pack-distribute";
import { leagueIdForMatchDay } from "@/lib/competitions";

/**
 * Owner-only: re-run research pack organise for a match (or Australia desks).
 * Fixes coach notes that were skipped when Manager Profiles children were
 * bare person headings (Popovic / Ancelotti).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !isOwnerEmail(session.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const matchId = typeof body.matchId === "string" ? body.matchId.trim() : "";
  const wantAustralia = body.australia === true || !matchId;

  const matches = matchId
    ? await prisma.match.findMany({
        where: { id: matchId },
        include: {
          matchDay: { select: { competition: true, title: true, userId: true, apiFootballLeagueId: true } },
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
        take: 1,
      })
    : await prisma.match.findMany({
        where: wantAustralia
          ? {
              OR: [
                { homeClub: { name: { contains: "Australia", mode: "insensitive" } } },
                { awayClub: { name: { contains: "Australia", mode: "insensitive" } } },
                { matchDay: { title: { contains: "Australia", mode: "insensitive" } } },
              ],
            }
          : undefined,
        include: {
          matchDay: { select: { competition: true, title: true, userId: true, apiFootballLeagueId: true } },
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
        orderBy: { kickoff: "desc" },
        take: 5,
      });

  if (!matches.length) {
    return NextResponse.json(
      { error: "No matching desks found", matchId: matchId || null },
      { status: 404 }
    );
  }

  const results: {
    matchId: string;
    title: string;
    home: string;
    away: string;
    homeCoaches: string[];
    awayCoaches: string[];
    summary: string | null;
    coachNotes: number;
    error?: string;
  }[] = [];

  for (const match of matches) {
    const research = await prisma.packSection.findUnique({
      where: {
        matchId_templateKey: { matchId: match.id, templateKey: "research" },
      },
    });
    const content = research?.content?.trim() || "";
    if (!content) {
      results.push({
        matchId: match.id,
        title: match.matchDay.title,
        home: match.homeClub.name,
        away: match.awayClub.name,
        homeCoaches: match.homeClub.coaches.map((c) => c.name),
        awayCoaches: match.awayClub.coaches.map((c) => c.name),
        summary: null,
        coachNotes: 0,
        error: "No research pack content on this desk",
      });
      continue;
    }

    try {
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
      const competition = match.matchDay.competition;
      const leagueId = leagueIdForMatchDay(match.matchDay);
      const distributed = await applyPackDistribution({
        matchId: match.id,
        userId: session.id,
        templateKey: "research",
        templateTitle: research?.title || "Research pack",
        content,
        homeClub: { id: match.homeClubId, name: match.homeClub.name },
        awayClub: { id: match.awayClubId, name: match.awayClub.name },
        allPlayers,
        coaches,
        competition,
        leagueEntityId: leagueId != null ? String(leagueId) : competition,
      });
      results.push({
        matchId: match.id,
        title: match.matchDay.title,
        home: match.homeClub.name,
        away: match.awayClub.name,
        homeCoaches: match.homeClub.coaches.map((c) => c.name),
        awayCoaches: match.awayClub.coaches.map((c) => c.name),
        summary: formatDistributeSummary(distributed),
        coachNotes: distributed.coachNotes,
      });
    } catch (e) {
      results.push({
        matchId: match.id,
        title: match.matchDay.title,
        home: match.homeClub.name,
        away: match.awayClub.name,
        homeCoaches: match.homeClub.coaches.map((c) => c.name),
        awayCoaches: match.awayClub.coaches.map((c) => c.name),
        summary: null,
        coachNotes: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
