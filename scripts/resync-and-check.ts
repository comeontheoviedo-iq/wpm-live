import { PrismaClient } from "@prisma/client";
import { syncMatchFromApiFootball } from "../lib/sync-fixture";
import { slotsFor } from "../lib/formations";

const MATCH_ID = "cmtmylflg0004trjj8tkq7q0h";
const prisma = new PrismaClient();

async function main() {
  console.log("Syncing", MATCH_ID);
  const result = await syncMatchFromApiFootball(MATCH_ID);
  console.log("Sync result keys:", Object.keys(result || {}));
  console.log(JSON.stringify(result, null, 2).slice(0, 800));

  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    include: {
      homeClub: { include: { players: { where: { isStarter: true } } } },
      awayClub: { include: { players: { where: { isStarter: true } } } },
    },
  });
  if (!match) throw new Error("match not found");

  const homeIds = new Set(slotsFor(match.homeFormation || "4-3-3").map((s) => s.id));
  const awayIds = new Set(slotsFor(match.awayFormation || "4-2-3-1").map((s) => s.id));

  const homeSlots = match.homeClub.players.map((p) => p.formationSlot).sort();
  const awaySlots = match.awayClub.players.map((p) => p.formationSlot).sort();

  console.log("\nHome formation:", match.homeFormation);
  console.log("Home starter slots:", homeSlots);
  console.log(
    "Home all in slotsFor?",
    homeSlots.every((s) => s && homeIds.has(s))
  );
  console.log("Away formation:", match.awayFormation);
  console.log("Away starter slots:", awaySlots);
  console.log(
    "Away all in slotsFor?",
    awaySlots.every((s) => s && awayIds.has(s))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
