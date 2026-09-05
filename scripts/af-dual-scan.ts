import { readFileSync } from "fs";
import { resolve } from "path";
const envPath = resolve(process.cwd(), ".env");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!(k in process.env)) process.env[k] = v;
}
import { PrismaClient } from "@prisma/client";
import { getPlayerById, getPlayersByTeam } from "../lib/api-football";

const prisma = new PrismaClient();

function norm(s?: string | null) {
  return (s || "").trim().toLowerCase();
}

async function main() {
  // Scan Rangers + Motherwell team pages for birth≠nationality
  const dual: { name: string; nat: string; birth: string; place?: string | null; id: number }[] = [];
  const same: number[] = [];
  for (const teamId of [257, 256]) {
    for (let page = 1; page <= 5; page++) {
      const rows = await getPlayersByTeam(teamId, 2025, page);
      if (!rows.length) break;
      for (const row of rows) {
        const nat = row.player.nationality || "";
        const birth = row.player.birth?.country || "";
        if (!nat && !birth) continue;
        if (norm(nat) && norm(birth) && norm(nat) !== norm(birth)) {
          dual.push({
            id: row.player.id,
            name: row.player.name,
            nat,
            birth,
            place: row.player.birth?.place,
          });
        } else {
          same.push(row.player.id);
        }
      }
      if (rows.length < 20) break;
    }
  }
  console.log("dual count", dual.length);
  console.log(JSON.stringify(dual, null, 2));
  console.log("same-ish count", same.length);

  // Also check national teams in stats for players where nationality is England
  const eng = await prisma.player.findMany({
    where: {
      club: { apiFootballTeamId: { in: [257, 256] } },
      nationality: { in: ["England", "ENG"] },
      apiFootballPlayerId: { not: null },
    },
    select: { name: true, apiFootballPlayerId: true, nationality: true },
  });
  console.log("\nEngland nationals national-team scan:");
  for (const p of eng) {
    const id = p.apiFootballPlayerId!;
    const rows = await getPlayerById(id, 2025).catch(() => []);
    const row = rows[0];
    if (!row) continue;
    const nationalish = (row.statistics || []).filter(
      (s) =>
        /africa|world cup|friendlies|nations|qualification|euro|copa/i.test(
          s.league?.name || ""
        ) ||
        (!/league|cup|championship|premiership|liga|serie|bundes|eredivisie|pro league|segunda|primeira/i.test(
          s.league?.name || ""
        ) &&
          s.team?.name &&
          s.team.name !== "Rangers" &&
          s.team.name !== "Motherwell")
    );
    const teams = [...new Set((row.statistics || []).map((s) => s.team?.name).filter(Boolean))];
    if (nationalish.length || teams.some((t) => t && t !== "Rangers" && t !== "Motherwell" && !/FC |United|City|Athletic|Rovers|Wanderers|Albion|Town|Hotspur/i.test(t))) {
      console.log(p.name, {
        nationality: row.player.nationality,
        birth: row.player.birth,
        teams,
        nationalish: nationalish.map((s) => ({ team: s.team?.name, league: s.league?.name, apps: s.games?.appearences })),
      });
    }
  }
}
main().finally(() => prisma.$disconnect());
