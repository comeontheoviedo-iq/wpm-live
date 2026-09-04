const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const MATCH_ID = "cmtmylflg0004trjj8tkq7q0h";

const FORMATIONS = {
  "4-3-3": ["GK","RB","RCB","LCB","LB","RCM","CM","LCM","RW","ST","LW"],
  "4-2-3-1": ["GK","RB","RCB","LCB","LB","RDM","LDM","RAM","CAM","LAM","ST"],
  "4-4-2": ["GK","RB","RCB","LCB","LB","RM","RCM","LCM","LM","RST","LST"],
  "3-5-2": ["GK","RCB","CB","LCB","RWB","RCM","CM","LCM","LWB","RST","LST"],
};

function slotsFor(f) {
  return FORMATIONS[f] || FORMATIONS["4-3-3"];
}

async function main() {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: {
      homeClub: true,
      awayClub: true,
    },
  });
  if (!match) throw new Error("match not found");
  const home = await prisma.player.findMany({
    where: { clubId: match.homeClubId, isStarter: true },
    select: { name: true, formationSlot: true, shirtNumber: true },
    orderBy: { shirtNumber: "asc" },
  });
  const away = await prisma.player.findMany({
    where: { clubId: match.awayClubId, isStarter: true },
    select: { name: true, formationSlot: true, shirtNumber: true },
    orderBy: { shirtNumber: "asc" },
  });
  const homeIds = new Set(slotsFor(match.homeFormation || "4-3-3"));
  const awayIds = new Set(slotsFor(match.awayFormation || "4-2-3-1"));
  console.log(JSON.stringify({
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
    home: home.map((p) => ({ n: p.shirtNumber, name: p.name, slot: p.formationSlot, ok: homeIds.has(p.formationSlot) })),
    away: away.map((p) => ({ n: p.shirtNumber, name: p.name, slot: p.formationSlot, ok: awayIds.has(p.formationSlot) })),
    homeAllOk: home.every((p) => homeIds.has(p.formationSlot)),
    awayAllOk: away.every((p) => awayIds.has(p.formationSlot)),
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
