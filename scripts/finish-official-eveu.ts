import { PrismaClient } from "@prisma/client";
import { maybeAutoGenerateLineupPack } from "../lib/pack-generate";
import { maybeReconcileNotesOnXiConfirm } from "../lib/reconcile-notes-on-xi";

const prisma = new PrismaClient();
const MATCH_ID = "cmtots5ds011oa69sd8ewl15x";

async function main() {
  const match = await prisma.match.findUnique({ where: { id: MATCH_ID } });
  if (!match) throw new Error("no match");

  // Ensure confirmed + formations even if race
  const updated = await prisma.match.update({
    where: { id: MATCH_ID },
    data: {
      lineupStatus: "confirmed",
      homeFormation: "4-2-3-1",
      awayFormation: "4-2-3-1",
    },
  });

  const homeStarters = await prisma.player.findMany({
    where: { clubId: match.homeClubId, isStarter: true },
    orderBy: { formationSlot: "asc" },
    select: { name: true, shirtNumber: true, formationSlot: true, onPitch: true, isCaptain: true },
  });
  const awayStarters = await prisma.player.findMany({
    where: { clubId: match.awayClubId, isStarter: true },
    orderBy: { formationSlot: "asc" },
    select: { name: true, shirtNumber: true, formationSlot: true, onPitch: true, isCaptain: true },
  });
  const homeBench = await prisma.player.findMany({
    where: { clubId: match.homeClubId, formationSlot: "BENCH" },
    orderBy: { shirtNumber: "asc" },
    select: { name: true, shirtNumber: true },
  });
  const awayBench = await prisma.player.findMany({
    where: { clubId: match.awayClubId, formationSlot: "BENCH" },
    orderBy: { shirtNumber: "asc" },
    select: { name: true, shirtNumber: true },
  });

  console.log("lineupStatus:", updated.lineupStatus);
  console.log("formations:", updated.homeFormation, "/", updated.awayFormation);
  console.log("\nEVE XI:", homeStarters.map(p => `${p.formationSlot}#${p.shirtNumber} ${p.name}${p.isCaptain?" (C)":""}`).join(" | "));
  console.log("EVE bench:", homeBench.map(p => `#${p.shirtNumber} ${p.name}`).join(", "));
  console.log("\nMUN XI:", awayStarters.map(p => `${p.formationSlot}#${p.shirtNumber} ${p.name}${p.isCaptain?" (C)":""}`).join(" | "));
  console.log("MUN bench:", awayBench.map(p => `#${p.shirtNumber} ${p.name}`).join(", "));
  console.log("\ncounts eve/mun starters:", homeStarters.length, awayStarters.length);

  // Snapshot predicted JSON from current starters
  const homeSlots = homeStarters
    .filter((p) => p.formationSlot)
    .map(async (p) => {
      const full = await prisma.player.findFirst({
        where: { clubId: match.homeClubId, shirtNumber: p.shirtNumber, name: p.name },
        select: { id: true, formationSlot: true },
      });
      return full;
    });
  // simpler:
  const homePlayers = await prisma.player.findMany({
    where: { clubId: match.homeClubId, isStarter: true },
    select: { id: true, formationSlot: true },
  });
  const awayPlayers = await prisma.player.findMany({
    where: { clubId: match.awayClubId, isStarter: true },
    select: { id: true, formationSlot: true },
  });
  await prisma.match.update({
    where: { id: MATCH_ID },
    data: {
      predictedHomeJson: JSON.stringify(
        homePlayers.map((p) => ({ playerId: p.id, formationSlot: p.formationSlot }))
      ),
      predictedAwayJson: JSON.stringify(
        awayPlayers.map((p) => ({ playerId: p.id, formationSlot: p.formationSlot }))
      ),
    },
  });

  console.log("\nTriggering pack…");
  const pack = await maybeAutoGenerateLineupPack({
    matchId: MATCH_ID,
    previousStatus: "expected",
    newStatus: "confirmed",
  });
  console.log("pack:", pack);

  console.log("Triggering notes reconcile…");
  const notes = await maybeReconcileNotesOnXiConfirm({
    matchId: MATCH_ID,
    previousStatus: "expected",
    newStatus: "confirmed",
  });
  console.log("notes:", notes);

  const after = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    select: {
      lineupStatus: true,
      homeFormation: true,
      awayFormation: true,
      lineupPackGeneratedAt: true,
      lineupPackXiHash: true,
    },
  });
  console.log("\nFINAL:", after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
