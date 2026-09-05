import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const match = await p.match.findUnique({
    where: { id: "cmto7ma85000610otexazyf6k" },
    include: { homeClub: true, awayClub: true },
  });
  console.log(
    "match",
    match?.id,
    match?.homeClub?.name,
    "vs",
    match?.awayClub?.name,
    "homeAf",
    match?.homeClub?.apiFootballTeamId,
    "awayAf",
    match?.awayClub?.apiFootballTeamId
  );
  const clubs = [match?.homeClubId, match?.awayClubId].filter(Boolean) as string[];
  const fern = await p.player.findMany({
    where: { clubId: { in: clubs }, name: { contains: "Fernandez" } },
  });
  console.log("Fernandez rows:", JSON.stringify(fern, null, 2));
  const rangers = match?.homeClub?.name?.includes("Rangers")
    ? match.homeClub
    : match?.awayClub?.name?.includes("Rangers")
      ? match.awayClub
      : null;
  if (rangers) {
    const players = await p.player.findMany({
      where: { clubId: rangers.id },
      orderBy: { shirtNumber: "asc" },
    });
    console.log("Rangers players nationality sample:");
    for (const pl of players) {
      console.log(
        pl.shirtNumber,
        pl.name,
        "|",
        pl.nationality,
        "| afId",
        pl.apiFootballPlayerId,
        "| birthDate",
        pl.birthDate
      );
    }
  }
}
main().finally(() => p.$disconnect());
