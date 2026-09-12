/**
 * Minimal seed — demo login + pack templates only.
 * Does NOT create fictional clubs/matches (Oviedo, Whitby, etc.).
 * Real desks come from API-Football linking.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PACK_TEMPLATE_SEEDS } from "../lib/pack-templates";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.upsert({
    where: { email: "demo@pitchline.app" },
    create: {
      email: "demo@pitchline.app",
      passwordHash,
      name: "Chris Beaumont",
      role: "commentator",
      avatarInitials: "CB",
      theme: "system",
      billingStatus: "active",
    },
    update: {
      passwordHash,
      name: "Chris Beaumont",
      role: "commentator",
      avatarInitials: "CB",
      billingStatus: "active",
    },
  });

  for (const t of PACK_TEMPLATE_SEEDS) {
    await prisma.packTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: {
        title: t.title,
        description: t.description,
        section: t.section,
        prompt: t.prompt,
        order: t.order,
      },
    });
  }

  // Purge fictional seed clubs/matches (no API-Football link) so re-seed cannot pollute.
  const fakeMatches = await prisma.match.findMany({
    where: { apiFootballFixtureId: null },
    select: { id: true, matchDayId: true },
  });
  const fakeMatchIds = fakeMatches.map((m) => m.id);
  const fakeMatchDayIds = [...new Set(fakeMatches.map((m) => m.matchDayId))];

  if (fakeMatchIds.length) {
    await prisma.packSection.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.penaltyRecord.deleteMany({ where: { clubId: { in: await orphanClubIds() } } }).catch(() => {});
    await prisma.matchEvent.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.checklistItem.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.speak.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.note.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.matchOfficial.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.statistic.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.injury.deleteMany({ where: { matchId: { in: fakeMatchIds } } });
    await prisma.match.deleteMany({ where: { id: { in: fakeMatchIds } } });
  }

  // Match days with no remaining matches
  for (const mdId of fakeMatchDayIds) {
    const left = await prisma.match.count({ where: { matchDayId: mdId } });
    if (left === 0) await prisma.matchDay.delete({ where: { id: mdId } }).catch(() => {});
  }

  // Clubs with no AF id and no remaining matches
  const orphanClubs = await prisma.club.findMany({
    where: { apiFootballTeamId: null },
    select: { id: true, name: true, homeMatches: { select: { id: true } }, awayMatches: { select: { id: true } } },
  });
  for (const c of orphanClubs) {
    if (c.homeMatches.length || c.awayMatches.length) continue;
    await prisma.seasonScorer.deleteMany({ where: { clubId: c.id } });
    await prisma.seasonKeeper.deleteMany({ where: { clubId: c.id } });
    await prisma.penaltyRecord.deleteMany({ where: { clubId: c.id } });
    await prisma.injury.deleteMany({ where: { clubId: c.id } });
    await prisma.player.deleteMany({ where: { clubId: c.id } });
    await prisma.coach.deleteMany({ where: { clubId: c.id } });
    await prisma.club.delete({ where: { id: c.id } });
    console.log("Removed fake club:", c.name);
  }

  // Orphan venues with no matches
  const venues = await prisma.venue.findMany({ include: { matches: { select: { id: true } } } });
  for (const v of venues) {
    if (!v.matches.length) await prisma.venue.delete({ where: { id: v.id } });
  }

  // Orphan officials with no match links
  const officials = await prisma.official.findMany({
    include: { matches: { select: { id: true } } },
  });
  for (const o of officials) {
    if (!o.matches.length) await prisma.official.delete({ where: { id: o.id } });
  }

  console.log("Seed complete (minimal).");
  console.log("Demo login: demo@pitchline.app / demo1234");
  console.log("User id:", user.id);
  console.log("Pack templates:", PACK_TEMPLATE_SEEDS.length);
}

async function orphanClubIds() {
  const clubs = await prisma.club.findMany({
    where: { apiFootballTeamId: null },
    select: { id: true },
  });
  return clubs.map((c) => c.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
