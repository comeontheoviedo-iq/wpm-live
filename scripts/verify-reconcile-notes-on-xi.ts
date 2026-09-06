/**
 * Dry-run / exercise note reconcile on Official XI confirm.
 * Usage: MATCH_ID=… npx tsx scripts/verify-reconcile-notes-on-xi.ts
 * Optional: RUN=1 to actually call maybeReconcileNotesOnXiConfirm
 */
import { PrismaClient } from "@prisma/client";
import { computeLineupXiHash } from "../lib/pack-generate";
import {
  loadConfirmedMatchdaySquad,
  maybeReconcileNotesOnXiConfirm,
} from "../lib/reconcile-notes-on-xi";

const prisma = new PrismaClient();
const MATCH_ID =
  process.env.MATCH_ID || "cmtots5ds011oa69sd8ewl15x"; // Everton–United seed

async function main() {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    select: {
      id: true,
      lineupStatus: true,
      lineupPackXiHash: true,
      homeClub: { select: { name: true } },
      awayClub: { select: { name: true } },
    },
  });
  if (!match) {
    console.log("MATCH_NOT_FOUND", MATCH_ID);
    return;
  }
  console.log("match", {
    id: match.id,
    fixture: `${match.homeClub.name} vs ${match.awayClub.name}`,
    lineupStatus: match.lineupStatus,
    lineupPackXiHash: match.lineupPackXiHash?.slice(0, 60),
  });

  const loaded = await loadConfirmedMatchdaySquad(MATCH_ID);
  const hash = await computeLineupXiHash(MATCH_ID);
  console.log("squadSize", loaded?.players.length ?? 0);
  console.log(
    "starters",
    loaded?.players.filter((p) => p.isStarter).map((p) => p.name)
  );
  console.log(
    "bench",
    loaded?.players
      .filter((p) => p.formationSlot === "BENCH")
      .map((p) => p.name)
  );
  console.log("coaches", loaded?.coaches.map((c) => c.name));
  console.log("xiHashLen", hash.length);

  const notes = await prisma.note.findMany({
    where: { matchId: MATCH_ID },
    select: {
      id: true,
      title: true,
      category: true,
      entityType: true,
      entityId: true,
    },
  });
  const keep = new Set(loaded?.players.map((p) => p.id) || []);
  const wouldPurge = notes.filter(
    (n) =>
      n.entityType === "player" && n.entityId && !keep.has(n.entityId)
  );
  console.log("notesTotal", notes.length);
  console.log(
    "wouldPurgePlayerNotes",
    wouldPurge.length,
    wouldPurge.slice(0, 12).map((n) => n.title)
  );
  console.log(
    "keepCounts",
    {
      match: notes.filter((n) => n.entityType === "match").length,
      club: notes.filter((n) => n.entityType === "club").length,
      playerInSquad: notes.filter(
        (n) => n.entityType === "player" && n.entityId && keep.has(n.entityId)
      ).length,
      coach: notes.filter((n) => n.entityType === "coach").length,
    }
  );

  console.log("\nPurge rules:");
  console.log(
    "- DELETE note where entityType=player AND entityId NOT IN matchday squad (starter|onPitch|BENCH)"
  );
  console.log(
    "- DELETE match Hook notes whose title/body match expected/predicted XI phrasing"
  );
  console.log(
    "- KEEP match / club / referee / general research / in-squad player / coach notes"
  );
  console.log("\nCreate rules:");
  console.log(
    "- Soft-create `${name} — Bio` for squad players missing any player note, body from research|profiles|hooks packs via extractPlayerSections"
  );
  console.log(
    "- Soft-create `${name} — Coach` when manager/coach section exists in packs"
  );
  console.log("- Never invent football facts; skip if no pack excerpt");

  if (process.env.RUN === "1") {
    const prev =
      process.env.FORCE_PREV ||
      (match.lineupStatus === "confirmed" ? "expected" : match.lineupStatus);
    console.log("\nRUN reconcile previousStatus=", prev);
    const r = await maybeReconcileNotesOnXiConfirm({
      matchId: MATCH_ID,
      previousStatus: prev,
      newStatus: "confirmed",
    });
    console.log("result", r);
  } else {
    console.log("\nDry-run only. Re-run with RUN=1 FORCE_PREV=expected to execute.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
