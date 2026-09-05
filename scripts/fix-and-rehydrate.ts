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

function pickNationalTeamCountry(statistics: any[] | undefined) {
  if (!statistics?.length) return null;
  let best: { country: string; apps: number } | null = null;
  for (const s of statistics) {
    const teamName = s.team?.name?.trim();
    if (!teamName) continue;
    if (/\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough)\b/i.test(teamName)) continue;
    if (!nationalityToIso(teamName)) continue;
    const league = s.league?.name || "";
    const intl =
      /world cup|friendlies|nations|africa cup|afcon|\beuro\b|copa|asian cup|gold cup|olympics|qualification|confederations|uefa nations|african nations/i.test(
        league
      );
    if (!intl) continue;
    const apps = s.games?.appearences ?? 0;
    if (apps <= 0) continue;
    if (!best || apps > best.apps) best = { country: teamName, apps };
  }
  return best?.country || null;
}

function sameCountryLabel(a?: string | null, b?: string | null) {
  const ia = nationalityToIso(a);
  const ib = nationalityToIso(b);
  if (ia && ib) return ia === ib;
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

async function enrichOne(apiId: number) {
  const rows = await getPlayerById(apiId, 2025);
  const row = rows[0];
  if (!row?.player) {
    console.log("no AF row", apiId);
    return null;
  }
  const afNat = row.player.nationality?.trim() || null;
  const nt = pickNationalTeamCountry(row.statistics);
  let nat = afNat;
  if (nt && (!afNat || !sameCountryLabel(afNat, nt))) nat = nt;
  const birthCountry = row.player.birth?.country?.trim() || null;
  console.log({
    apiId,
    name: row.player.name,
    afNat,
    nt,
    chosenNat: nat,
    birthCountry,
    birthPlace: row.player.birth?.place,
  });
  return { nat, birthCountry, name: row.player.name };
}

async function main() {
  const prisma = new PrismaClient();
  // Fix Fernandez + Maswanhise + Dessers explicitly from AF
  for (const apiId of [322882, 278116, 37186]) {
    const info = await enrichOne(apiId);
    if (!info) continue;
    const updated = await prisma.player.updateMany({
      where: { apiFootballPlayerId: apiId },
      data: {
        nationality: info.nat || "UNK",
        birthCountry: info.birthCountry,
      },
    });
    console.log("updated rows", updated.count, apiId);
  }

  const sample = await prisma.player.findMany({
    where: {
      apiFootballPlayerId: { in: [322882, 278116, 37186, 20143, 199638] },
    },
    select: {
      name: true,
      nationality: true,
      birthCountry: true,
      apiFootballPlayerId: true,
    },
  });
  console.log("sample after fix", sample);
  await prisma.$disconnect();
}
main();
