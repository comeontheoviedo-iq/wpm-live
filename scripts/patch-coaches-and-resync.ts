import { PrismaClient } from "@prisma/client";
import { syncCoachForClub, syncMatchFromApiFootball } from "../lib/sync-fixture";
import { PACK_TEMPLATE_SEEDS } from "../lib/pack-templates";
import { flagUrl, nationalityToIso } from "../lib/flags";

const prisma = new PrismaClient();
const RANGERS_MATCH = "cmto7ma85000610otexazyf6k";

async function upsertPackTemplates() {
  for (const t of PACK_TEMPLATE_SEEDS) {
    await prisma.packTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        title: t.title,
        description: t.description,
        section: t.section,
        prompt: t.prompt,
        order: t.order,
      },
      update: {
        title: t.title,
        description: t.description,
        section: t.section,
        prompt: t.prompt,
        order: t.order,
      },
    });
  }
  console.log("Pack templates upserted:", PACK_TEMPLATE_SEEDS.length);
  const intro = PACK_TEMPLATE_SEEDS.find((t) => t.key === "intro");
  console.log("intro has 400-700 guidance?", Boolean(intro?.prompt.includes("400")));
  console.log(
    "hooks CRITICAL?",
    Boolean(PACK_TEMPLATE_SEEDS.find((t) => t.key === "hooks")?.prompt.includes("CRITICAL"))
  );
}

async function main() {
  await upsertPackTemplates();

  const cleared = await prisma.coach.updateMany({
    where: { nationality: { in: ["ENG", "UNKNOWN", ""] } },
    data: { nationality: "UNK" },
  });
  console.log("coaches ENG/empty -> UNK", cleared.count);

  const clubs = await prisma.club.findMany({
    where: {
      OR: [
        { name: { contains: "Ranger" } },
        { name: { contains: "Mother" } },
        { name: { contains: "Lyon" } },
      ],
    },
  });
  for (const c of clubs) {
    if (!c.apiFootballTeamId) {
      console.log("skip club no AF id", c.name);
      continue;
    }
    const id = await syncCoachForClub(c.id, c.apiFootballTeamId);
    console.log("synced coach for", c.name, "->", id);
  }

  console.log("\nRe-syncing Rangers match", RANGERS_MATCH);
  const r = await syncMatchFromApiFootball(RANGERS_MATCH);
  console.log("sync lineupStatus", (r as { match?: { lineupStatus?: string } }).match?.lineupStatus);
  console.log("squadHome/Away", r.squadHome, r.squadAway);
  console.log("scorers/keepers", r.scorersSynced, r.keepersSynced);

  const coaches = await prisma.coach.findMany({
    include: { club: true },
    where: {
      club: {
        OR: [
          { name: { contains: "Ranger" } },
          { name: { contains: "Mother" } },
          { name: { contains: "Lyon" } },
        ],
      },
    },
  });
  console.log("\n=== COACHES ===");
  for (const c of coaches) {
    console.log(
      `${c.club.name} | ${c.name} | nat=${c.nationality} | age=${c.age} | iso=${nationalityToIso(c.nationality)} | flag=${flagUrl(c.nationality, 20)}`
    );
  }

  const engCoaches = await prisma.coach.count({ where: { nationality: "ENG" } });
  console.log("ENG coaches remaining:", engCoaches);

  const unk = await prisma.player.count({
    where: {
      nationality: { in: ["UNK", "ENG"] },
      club: {
        OR: [
          { name: { contains: "Ranger" } },
          { name: { contains: "Mother" } },
          { name: { contains: "Lyon" } },
        ],
      },
    },
  });
  console.log("UNK/ENG players (Rangers/Motherwell/Lyon):", unk);

  const samples = await prisma.player.findMany({
    where: {
      OR: [
        { name: { contains: "Souttar" } },
        { name: { contains: "Raskin" } },
        { name: { contains: "Shankland" } },
        { name: { contains: "Nsiala" } },
      ],
    },
    include: { club: true },
  });
  console.log("\n=== SAMPLE PLAYERS ===");
  for (const p of samples) {
    console.log(`${p.club.name} | ${p.name} | ${p.nationality}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
