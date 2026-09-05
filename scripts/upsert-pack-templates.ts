import { PrismaClient } from "@prisma/client";
import { PACK_TEMPLATE_SEEDS } from "../lib/pack-templates";

const prisma = new PrismaClient();

async function main() {
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
  const intro = await prisma.packTemplate.findUnique({ where: { key: "intro" } });
  const research = await prisma.packTemplate.findUnique({
    where: { key: "research" },
  });
  const lineup = await prisma.packTemplate.findUnique({ where: { key: "lineup" } });
  console.log("upserted", PACK_TEMPLATE_SEEDS.length);
  console.log("intro has 600-900?", Boolean(intro?.prompt.includes("600–900")));
  console.log(
    "research Venue & atmosphere?",
    Boolean(research?.prompt.includes("Venue & atmosphere"))
  );
  console.log(
    "lineup Here are the two starting lineups?",
    Boolean(lineup?.prompt.includes("Here are the two starting lineups"))
  );
  console.log(
    "lineup unable to confirm changes?",
    Boolean(lineup?.prompt.includes("unable to confirm changes from last outing"))
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
