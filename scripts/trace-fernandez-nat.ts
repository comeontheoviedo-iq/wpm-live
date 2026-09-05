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
import { getPlayersByTeam, getPlayerById, getTopScorers } from "../lib/api-football";
import { nationalityToIso } from "../lib/flags";

function pickNationalTeamCountry(statistics: any[] | undefined) {
  if (!statistics?.length) return null;
  let best: { country: string; apps: number } | null = null;
  for (const s of statistics) {
    const teamName = s.team?.name?.trim();
    if (!teamName) continue;
    if (/\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough)\b/i.test(teamName)) continue;
    if (!nationalityToIso(teamName)) continue;
    const league = s.league?.name || "";
    const intl = /world cup|friendlies|nations|africa cup|afcon|\beuro\b|copa|asian cup|gold cup|olympics|qualification|confederations|uefa nations|african nations/i.test(league);
    if (!intl) continue;
    const apps = s.games?.appearences ?? 0;
    if (apps <= 0) continue;
    if (!best || apps > best.apps) best = { country: teamName, apps };
  }
  return best?.country || null;
}

async function main() {
  // Scan all Rangers team page rows for id 322882 and any Nigeria
  for (let page = 1; page <= 4; page++) {
    const rows = await getPlayersByTeam(257, 2025, page);
    if (!rows.length) break;
    for (const row of rows) {
      if (row.player.id === 322882 || /fernandez/i.test(row.player.name) || row.player.nationality === "Nigeria") {
        console.log("Rangers page", page, {
          id: row.player.id,
          name: row.player.name,
          nat: row.player.nationality,
          birth: row.player.birth,
          nt: pickNationalTeamCountry(row.statistics),
          teams: row.statistics?.map((s) => s.team?.name),
        });
      }
    }
    if (rows.length < 20) break;
  }
  // Motherwell Maswanhise on team page
  for (let page = 1; page <= 4; page++) {
    const rows = await getPlayersByTeam(256, 2025, page);
    if (!rows.length) break;
    for (const row of rows) {
      if (/maswanhise/i.test(row.player.name)) {
        console.log("Motherwell page", page, {
          id: row.player.id,
          name: row.player.name,
          nat: row.player.nationality,
          birth: row.player.birth,
          nt: pickNationalTeamCountry(row.statistics),
          teams: row.statistics?.map((s) => `${s.team?.name}|${s.league?.name}|${s.games?.appearences}`),
        });
      }
    }
    if (rows.length < 20) break;
  }

  // topscorers league 179 = Scottish Premiership?
  // From match - check competition
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const match = await prisma.match.findUnique({ where: { id: "cmto7ma85000610otexazyf6k" }, include: { competition: true } });
  console.log("competition", match?.competition);
  await prisma.$disconnect();
}
main();
