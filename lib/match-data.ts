import { prisma } from "./prisma";

export async function getFeaturedMatchId() {
  const m = await prisma.match.findFirst({
    where: { featured: true },
    orderBy: { kickoff: "asc" },
  });
  return m?.id;
}

export async function getMatchFull(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeClub: {
        include: {
          players: { orderBy: { shirtNumber: "asc" } },
          coaches: true,
        },
      },
      awayClub: {
        include: {
          players: { orderBy: { shirtNumber: "asc" } },
          coaches: true,
        },
      },
      venue: true,
      matchDay: true,
      notes: { orderBy: { createdAt: "desc" } },
      speaks: { orderBy: { order: "asc" } },
      checklistItems: { orderBy: { order: "asc" } },
      events: {
        orderBy: [{ minute: "desc" }, { createdAt: "desc" }],
        include: { player: true },
      },
      officials: { include: { official: true } },
      injuries: { include: { player: true, club: true } },
      statistics: { orderBy: { order: "asc" } },
      playerOverrides: true,
    },
  });
}
