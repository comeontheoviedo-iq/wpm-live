/**
 * One-shot: generate 2H intro for a match (or matchDay id).
 * Usage: DATABASE_URL=postgres://... npx tsx scripts/gen-ht-2h-intro.ts <matchOrMatchDayId>
 */
import { PrismaClient } from "@prisma/client";
import { buildHt2hIntroScript } from "../lib/ht-2h-intro";

const prisma = new PrismaClient();
const id = process.argv[2] || "cmtuguaof0004rarmb9711ja5";

async function main() {
  let match = await prisma.match.findUnique({
    where: { id },
    include: {
      matchDay: true,
      homeClub: true,
      awayClub: true,
      events: { orderBy: [{ minute: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!match) {
    const md = await prisma.matchDay.findUnique({
      where: { id },
      include: {
        matches: {
          include: {
            matchDay: true,
            homeClub: true,
            awayClub: true,
            events: { orderBy: [{ minute: "asc" }, { createdAt: "asc" }] },
          },
        },
      },
    });
    match = md?.matches[0] || null;
  }
  if (!match) {
    console.error("Match not found", id);
    process.exit(1);
  }
  const homeName = match.homeClub.shortName || match.homeClub.name;
  const awayName = match.awayClub.shortName || match.awayClub.name;
  const script = buildHt2hIntroScript({
    homeName,
    awayName,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    competition: match.matchDay.competition,
    events: match.events.map((e) => ({
      type: e.type,
      minute: e.minute,
      description: e.description,
      teamSide: e.teamSide,
    })),
    homeFormation: match.homeFormation,
    awayFormation: match.awayFormation,
  });
  const title = `2nd half intro · ${homeName} ${match.homeScore}–${match.awayScore} ${awayName}`;
  const existing = await prisma.speak.findFirst({
    where: {
      matchId: match.id,
      timing: "half-time",
      OR: [
        { title: { startsWith: "2nd half intro" } },
        { title: { startsWith: "2H intro" } },
      ],
    },
  });
  if (existing && existing.status !== "edited") {
    await prisma.speak.update({
      where: { id: existing.id },
      data: { title, body: script, status: "generated" },
    });
  } else if (!existing) {
    await prisma.speak.create({
      data: {
        matchId: match.id,
        title,
        body: script,
        timing: "half-time",
        status: "generated",
        order: 0,
      },
    });
  }
  await prisma.packSection.upsert({
    where: {
      matchId_templateKey: { matchId: match.id, templateKey: "ht_2h_intro" },
    },
    create: {
      matchId: match.id,
      templateKey: "ht_2h_intro",
      title: "2nd half intro",
      content: script,
      status: "ready",
    },
    update: { content: script, title: "2nd half intro", status: "ready" },
  });
  console.log("SAVED", match.id, title);
  console.log(script);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
