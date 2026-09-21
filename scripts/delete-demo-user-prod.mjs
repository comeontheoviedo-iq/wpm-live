/**
 * Delete demo@pitchline.app (+ leftover owned desks/notes/speaks) from Postgres.
 * Does NOT touch chris@ronniedogmedia.com, barryswain@live.co.uk, or other accounts.
 * Prefer netlify/database/migrations/20260921081500_delete_demo_pitchline_user.sql on deploy
 * when only netlifydb_readonly is available via API.
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

const TARGETS = ["demo@pitchline.app", "demo@cocomms.online"];
const PROTECTED = new Set([
  "chris@ronniedogmedia.com",
  "barryswain@live.co.uk",
  "tester@cocomms.online",
]);

const url = resolveUrl();
if (!url) {
  console.error("delete-demo-user-prod: no Postgres URL");
  process.exit(1);
}
if (url.includes("netlifydb_readonly")) {
  console.error("delete-demo-user-prod: got readonly URL — use the DML migration deploy instead");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({
    where: { email: { in: TARGETS } },
    select: { id: true, email: true },
  });
  if (!users.length) {
    console.log(JSON.stringify({ deleted: false, reason: "not_found", targets: TARGETS }));
    process.exit(0);
  }
  for (const u of users) {
    if (PROTECTED.has(u.email)) {
      console.error("Refusing protected email", u.email);
      process.exit(1);
    }
  }

  const report = [];
  await prisma.$transaction(async (tx) => {
    for (const u of users) {
      const matchDays = await tx.matchDay.deleteMany({ where: { userId: u.id } });
      const notes = await tx.note.deleteMany({ where: { userId: u.id } });
      const speaks = await tx.speak.deleteMany({ where: { userId: u.id } });
      const aliases = await tx.userPlayerAlias.deleteMany({ where: { userId: u.id } });
      const resets = await tx.passwordResetToken.deleteMany({ where: { userId: u.id } });
      const pings = await tx.supportPing.deleteMany({ where: { userId: u.id } });
      try {
        await tx.userProductUpdateRead.deleteMany({ where: { userId: u.id } });
      } catch {
        /* model may be absent on older clients */
      }
      await tx.user.delete({ where: { id: u.id } });
      report.push({
        email: u.email,
        userId: u.id,
        deletedDesks: matchDays.count,
        deletedNotes: notes.count,
        deletedSpeaks: speaks.count,
        deletedAliases: aliases.count,
        deletedResets: resets.count,
        deletedPings: pings.count,
      });
    }
  });

  const leftovers = await prisma.user.findMany({
    where: { email: { in: TARGETS } },
    select: { email: true },
  });
  const protectedStill = await prisma.user.findMany({
    where: { email: { in: [...PROTECTED] } },
    select: { email: true },
  });
  console.log(JSON.stringify({ deleted: report, leftovers, protectedStill }, null, 2));
} catch (e) {
  console.error("delete-demo-user-prod failed:", e?.message || e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
