/**
 * Reassign ALL ownership from demo@pitchline.app → chris@ronniedogmedia.com.
 * Does NOT touch tester@cocomms.online or any other user.
 * Reassigns FKs only (no delete/recreate): MatchDay.userId, Note.userId,
 * Speak.userId, UrShow.claimedByUserId.
 */
import { PrismaClient } from "@prisma/client";

function resolveUrl() {
  const current = process.env.DATABASE_URL?.trim() ?? "";
  const netlify = process.env.NETLIFY_DB_URL?.trim() ?? "";
  const isPg = (u) => u.startsWith("postgresql://") || u.startsWith("postgres://");
  if (isPg(current)) return current;
  if (isPg(netlify)) {
    process.env.DATABASE_URL = netlify;
    return netlify;
  }
  return null;
}

const FROM = "demo@pitchline.app";
const TO = "chris@ronniedogmedia.com";

const url = resolveUrl();
if (!url) {
  console.error("migrate-demo-desks-to-chris: no Postgres URL");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const fromUser = await prisma.user.findUnique({ where: { email: FROM } });
  const toUser = await prisma.user.findUnique({ where: { email: TO } });
  if (!fromUser) {
    console.error("Source user missing:", FROM);
    process.exit(1);
  }
  if (!toUser) {
    console.error("Target user missing:", TO, "— seed chris first");
    process.exit(1);
  }
  if (fromUser.id === toUser.id) {
    console.error("from/to same user id — abort");
    process.exit(1);
  }

  console.log("from", FROM, fromUser.id);
  console.log("to  ", TO, toUser.id);

  const counts = await prisma.$transaction(async (tx) => {
    const matchDays = await tx.matchDay.updateMany({
      where: { userId: fromUser.id },
      data: { userId: toUser.id },
    });
    const notes = await tx.note.updateMany({
      where: { userId: fromUser.id },
      data: { userId: toUser.id },
    });
    const speaks = await tx.speak.updateMany({
      where: { userId: fromUser.id },
      data: { userId: toUser.id },
    });
    const urShows = await tx.urShow.updateMany({
      where: { claimedByUserId: fromUser.id },
      data: { claimedByUserId: toUser.id },
    });
    return {
      matchDays: matchDays.count,
      notes: notes.count,
      speaks: speaks.count,
      urShows: urShows.count,
    };
  });

  // Verify nothing left on demo for these tables
  const leftover = {
    matchDays: await prisma.matchDay.count({ where: { userId: fromUser.id } }),
    notes: await prisma.note.count({ where: { userId: fromUser.id } }),
    speaks: await prisma.speak.count({ where: { userId: fromUser.id } }),
    urShows: await prisma.urShow.count({ where: { claimedByUserId: fromUser.id } }),
  };
  const chrisNow = {
    matchDays: await prisma.matchDay.count({ where: { userId: toUser.id } }),
    notes: await prisma.note.count({ where: { userId: toUser.id } }),
    speaks: await prisma.speak.count({ where: { userId: toUser.id } }),
    urShows: await prisma.urShow.count({ where: { claimedByUserId: toUser.id } }),
  };
  // Ensure tester untouched
  const tester = await prisma.user.findUnique({ where: { email: "tester@cocomms.online" } });
  let testerCounts = null;
  if (tester) {
    testerCounts = {
      matchDays: await prisma.matchDay.count({ where: { userId: tester.id } }),
      notes: await prisma.note.count({ where: { userId: tester.id } }),
      speaks: await prisma.speak.count({ where: { userId: tester.id } }),
    };
  }

  console.log(JSON.stringify({ migrated: counts, leftoverOnDemo: leftover, chrisTotals: chrisNow, testerUntouched: testerCounts }, null, 2));
} catch (e) {
  console.error("migrate failed:", e?.message || e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
