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
import { getPlayersByTeam, getTopScorers } from "../lib/api-football";

async function main() {
  const missing: any[] = [];
  const ids = new Map<number, string>();
  for (const teamId of [257, 256]) {
    for (let page = 1; page <= 5; page++) {
      const rows = await getPlayersByTeam(teamId, 2025, page);
      if (!rows.length) break;
      for (const row of rows) {
        if (!row.player?.id) missing.push({ teamId, page, name: row.player?.name, nat: row.player?.nationality });
        else {
          const prev = ids.get(row.player.id);
          if (prev && prev !== row.player.name) {
            console.log("ID COLLISION", row.player.id, prev, row.player.name);
          }
          ids.set(row.player.id, row.player.name);
        }
      }
      if (rows.length < 20) break;
    }
  }
  console.log("missing ids", missing.length, missing.slice(0, 5));
  console.log("unique players", ids.size);
  // Check if Fernandez and Dessers adjacent somehow in upsert name match
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const dessers = await prisma.player.findMany({ where: { OR: [{ name: { contains: "Dessers" } }, { apiFootballPlayerId: 37186 }] } });
  console.log("dessers in db", dessers);
  await prisma.$disconnect();
}
main();
