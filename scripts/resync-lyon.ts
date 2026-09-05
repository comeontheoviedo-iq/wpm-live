import { syncMatchFromApiFootball } from "../lib/sync-fixture";
import { PrismaClient } from "@prisma/client";
import { flagUrl, nationalityToIso } from "../lib/flags";

const prisma = new PrismaClient();

async function main() {
  // Clear ENG placeholders so enrich always writes AF nationality
  const cleared = await prisma.player.updateMany({
    where: { nationality: "ENG" },
    data: { nationality: "UNK" },
  });
  console.log("cleared ENG->UNK", cleared.count);

  const r = await syncMatchFromApiFootball("cmtmylflg0004trjj8tkq7q0h");
  console.log("Lyon sync keys", Object.keys(r));
  console.log("lineupStatus", (r as any).match?.lineupStatus);

  // Also re-sync Rangers to fill more bios if pages cached
  const r2 = await syncMatchFromApiFootball("cmto7ma85000610otexazyf6k");
  console.log("Rangers sync lineupStatus", (r2 as any).match?.lineupStatus);

  const samples = await prisma.player.findMany({
    where: {
      OR: [
        { name: { contains: "Openda" } },
        { name: { contains: "Tolisso" } },
        { name: { contains: "Tagliafico" } },
        { name: { contains: "Raskin" } },
        { name: { contains: "Shankland" } },
        { name: { contains: "Greif" } },
        { name: { contains: "Niakhat" } },
        { name: { contains: "Lowry" } },
      ],
    },
    include: { club: true },
  });
  for (const p of samples) {
    console.log(
      `${p.club.name} | ${p.name} | ${p.nationality} | iso=${nationalityToIso(p.nationality)} | flag=${flagUrl(p.nationality, 20)}`
    );
  }

  const engLeft = await prisma.player.count({ where: { nationality: "ENG" } });
  const unk = await prisma.player.groupBy({
    by: ["nationality"],
    _count: true,
    orderBy: { _count: { nationality: "desc" } },
  });
  console.log("ENG remaining", engLeft);
  console.log("top nats", unk.slice(0, 15));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
