import { prisma } from "./prisma";

const matchFullInclude = {
  homeClub: {
    include: {
      players: { orderBy: { shirtNumber: "asc" as const } },
      coaches: true,
    },
  },
  awayClub: {
    include: {
      players: { orderBy: { shirtNumber: "asc" as const } },
      coaches: true,
    },
  },
  venue: true,
  matchDay: true,
  notes: { orderBy: { createdAt: "desc" as const } },
  speaks: { orderBy: { order: "asc" as const } },
  checklistItems: { orderBy: { order: "asc" as const } },
  events: {
    orderBy: [{ minute: "desc" as const }, { createdAt: "desc" as const }],
    include: { player: true },
  },
  officials: { include: { official: true } },
  injuries: { include: { player: true, club: true } },
  statistics: { orderBy: { order: "asc" as const } },
  playerOverrides: true,
} as const;

export async function getFeaturedMatchId() {
  const m = await prisma.match.findFirst({
    where: { featured: true },
    orderBy: { kickoff: "asc" },
  });
  return m?.id;
}

/**
 * Resolve a match desk URL id. Desk/nav sometimes pass MatchDay id;
 * prefer Match id, then fall back to the first/only match for that MatchDay.
 */
export async function getMatchFull(id: string) {
  const byMatch = await prisma.match.findUnique({
    where: { id },
    include: matchFullInclude,
  });
  if (byMatch) return byMatch;

  return prisma.match.findFirst({
    where: { matchDayId: id },
    orderBy: { kickoff: "asc" },
    include: matchFullInclude,
  });
}
