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
import { getPlayerById } from "../lib/api-football";

// Look at full statistics for Fernandez + Kim for national team clues
async function main() {
  for (const id of [322882, 397941, 199638, 338507]) {
    const rows = await getPlayerById(id, 2025);
    const row = rows[0];
    if (!row) continue;
    console.log("\n===", row.player.name, "stats teams/leagues:");
    for (const s of row.statistics || []) {
      console.log({
        team: s.team?.name,
        teamId: s.team?.id,
        league: s.league?.name,
        country: s.league?.country,
        season: s.league?.season,
        apps: s.games?.appearences,
      });
    }
  }
}
main();
