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
import { syncMatchFromApiFootball } from "../lib/sync-fixture";
import { dualNationalities, nationalityToIso, flagUrl } from "../lib/flags";

const MATCH = "cmto7ma85000610otexazyf6k";
const prisma = new PrismaClient();

async function main() {
  console.log("Syncing", MATCH);
  const r = await syncMatchFromApiFootball(MATCH);
  console.log("sync done", Object.keys(r || {}));

  const match = await prisma.match.findUnique({
    where: { id: MATCH },
    include: {
      homeClub: { include: { players: true } },
      awayClub: { include: { players: true } },
    },
  });
  if (!match) throw new Error("match missing");

  const all = [...match.homeClub.players, ...match.awayClub.players];
  const focusNames = [
    "Fernandez",
    "Diomandé",
    "Diomande",
    "Maswanhise",
    "Dessers",
    "Charles-Cook",
    "Bajrami",
    "Gassama",
    "Nsiala",
    "Chermiti",
    "Matondo",
  ];
  const focus = all.filter((p) =>
    focusNames.some((n) => p.name.toLowerCase().includes(n.toLowerCase()))
  );

  // Also any dual where birthCountry differs
  const duals = all.filter((p) => {
    const d = dualNationalities(p.nationality, p.birthCountry);
    return d.length >= 2;
  });

  console.log("\n=== Focus players ===");
  for (const p of [...focus, ...duals.filter((d) => !focus.find((f) => f.id === d.id))]) {
    const flags = dualNationalities(p.nationality, p.birthCountry);
    console.log({
      name: p.name,
      club: p.clubId === match.homeClubId ? match.homeClub.shortName : match.awayClub.shortName,
      nationality: p.nationality,
      birthCountry: p.birthCountry,
      flagCodes: flags.map((n) => nationalityToIso(n)),
      flagUrls: flags.map((n) => flagUrl(n, 20)),
    });
  }

  console.log("\nDual-flag count on match:", duals.length);
  console.log(
    "Dual names:",
    duals.map((p) => `${p.name} (${p.nationality}/${p.birthCountry})`).join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
