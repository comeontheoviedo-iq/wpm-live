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

function pickNationalTeamCountry(
  statistics?: {
    team?: { id?: number; name?: string } | null;
    league?: { name?: string; country?: string | null } | null;
    games?: { appearences?: number | null } | null;
  }[]
): string | null {
  if (!statistics?.length) return null;
  let best: { country: string; apps: number } | null = null;
  for (const s of statistics) {
    const teamName = s.team?.name?.trim();
    if (!teamName) continue;
    if (
      /\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough)\b/i.test(
        teamName
      )
    ) {
      console.log("skip clubby", teamName);
      continue;
    }
    const iso = nationalityToIso(teamName);
    console.log("team", teamName, "iso", iso, "league", s.league?.name, "apps", s.games?.appearences);
    if (!iso) continue;
    const league = s.league?.name || "";
    const intl =
      /world cup|friendlies|nations|africa cup|afcon|\beuro\b|copa|asian cup|gold cup|olympics|qualification|confederations|uefa nations|african nations/i.test(
        league
      );
    console.log("  intl?", intl);
    if (!intl) continue;
    const apps = s.games?.appearences ?? 0;
    if (apps <= 0) continue;
    if (!best || apps > best.apps) best = { country: teamName, apps };
  }
  return best?.country || null;
}

async function main() {
  const prisma = new PrismaClient();
  const p = await prisma.player.findFirst({ where: { name: { contains: "Maswanhise" } } });
  console.log("db", {
    name: p?.name,
    nationality: p?.nationality,
    birthCountry: p?.birthCountry,
    apiId: p?.apiFootballPlayerId,
  });
  if (!p?.apiFootballPlayerId) return;
  const af = await getPlayerById(p.apiFootballPlayerId, 2025);
  console.log("af nat/birth", af[0]?.player?.nationality, af[0]?.player?.birth);
  console.log("picked", pickNationalTeamCountry(af[0]?.statistics));
  await prisma.$disconnect();
}
main();
