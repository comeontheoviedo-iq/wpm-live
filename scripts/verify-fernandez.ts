import { readFileSync } from "fs";
import { resolve } from "path";
const envPath = resolve(process.cwd(), ".env");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}
import { PrismaClient } from "@prisma/client";
import { getPlayerById } from "../lib/api-football";
import { nationalityToIso } from "../lib/flags";

async function main() {
  const prisma = new PrismaClient();
  const p = await prisma.player.findFirst({
    where: { name: { contains: "Fernandez" }, club: { name: { contains: "Rangers" } } },
  });
  console.log("DB Fernandez", p);

  // any Nigeria players
  const nig = await prisma.player.findMany({
    where: {
      club: { name: { contains: "Rangers" } },
      OR: [{ nationality: "Nigeria" }, { name: { contains: "Dessers" } }],
    },
  });
  console.log("Nigeria/Dessers on Rangers", nig.map((x) => ({ name: x.name, nat: x.nationality, birth: x.birthCountry, af: x.apiFootballPlayerId })));

  if (p?.apiFootballPlayerId) {
    const rows = await getPlayerById(p.apiFootballPlayerId, 2025);
    const row = rows[0];
    console.log("AF player", {
      id: row?.player?.id,
      name: row?.player?.name,
      nationality: row?.player?.nationality,
      birth: row?.player?.birth,
    });
    console.log(
      "AF teams",
      (row?.statistics || []).map((s) => ({
        team: s.team?.name,
        league: s.league?.name,
        apps: s.games?.appearences,
        iso: nationalityToIso(s.team?.name),
      }))
    );
  }

  // Maswanhise again
  const m = await prisma.player.findFirst({ where: { name: { contains: "Maswanhise" } } });
  console.log("DB Maswanhise", { name: m?.name, nat: m?.nationality, birth: m?.birthCountry, af: m?.apiFootballPlayerId });
  if (m?.apiFootballPlayerId) {
    const rows = await getPlayerById(m.apiFootballPlayerId, 2025);
    console.log("AF Maswanhise", rows[0]?.player?.nationality, rows[0]?.player?.birth);
    console.log(
      "NT teams",
      (rows[0]?.statistics || [])
        .filter((s) => nationalityToIso(s.team?.name))
        .map((s) => ({ team: s.team?.name, league: s.league?.name, apps: s.games?.appearences }))
    );
  }
  await prisma.$disconnect();
}
main();
