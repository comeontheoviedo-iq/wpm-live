import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const MATCH_ID = "cmtots5ds011oa69sd8ewl15x";
async function main() {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: { homeClub: true, awayClub: true },
  });
  if (!match) { console.log("NO MATCH"); return; }
  console.log(JSON.stringify({
    id: match.id,
    matchDayId: match.matchDayId,
    af: match.apiFootballFixtureId,
    status: match.status,
    lineupStatus: match.lineupStatus,
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
    home: match.homeClub.name,
    away: match.awayClub.name,
    homeClubId: match.homeClubId,
    awayClubId: match.awayClubId,
  }, null, 2));
  for (const pair of [
    ["HOME", match.homeClubId],
    ["AWAY", match.awayClubId],
  ] as [string, string][]) {
    const label = pair[0];
    const clubId = pair[1];
    const players = await prisma.player.findMany({
      where: { clubId },
      orderBy: { shirtNumber: "asc" },
      select: { id: true, name: true, shirtNumber: true, position: true, isStarter: true, onPitch: true, formationSlot: true, isCaptain: true },
    });
    console.log("\n==="+label+"===", players.length);
    for (const p of players) {
      console.log(`${String(p.shirtNumber).padStart(3)} ${p.name.padEnd(28)} ${p.position.padEnd(4)} starter=${p.isStarter} pitch=${p.onPitch} slot=${p.formationSlot||"-"} cap=${p.isCaptain}`);
    }
  }
}
main().finally(()=>prisma.$disconnect());
