import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env without printing secrets
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

import { getPlayerById } from "../lib/api-football";

const ids = [
  322882, // E. Fernandez
  199638, // M. Diomandé
  336563, // D. Gassama
  19990, // D. Sterling
  6832, // C. Devlin
  19073, // B. Godfrey
  338507, // C. Nsiala-Makengo
  280305, // R. Naderi
  330412, // Youssef Chermiti
  397941, // M. Kim
];

function dump(row: Awaited<ReturnType<typeof getPlayerById>>[0]) {
  const p = row.player as Record<string, unknown>;
  console.log(
    JSON.stringify(
      {
        id: p.id,
        name: p.name,
        nationality: p.nationality,
        birth: p.birth,
        age: p.age,
        playerKeys: Object.keys(p),
      },
      null,
      2
    )
  );
}

async function main() {
  console.log("key present?", Boolean(process.env.API_FOOTBALL_KEY?.trim()));
  for (const id of ids) {
    let rows = await getPlayerById(id, 2025).catch((e: Error) => {
      console.error("err season", id, e.message);
      return [] as Awaited<ReturnType<typeof getPlayerById>>;
    });
    if (!rows[0]) {
      rows = await getPlayerById(id).catch((e: Error) => {
        console.error("err noseason", id, e.message);
        return [] as Awaited<ReturnType<typeof getPlayerById>>;
      });
    }
    console.log("\n===", id, rows[0] ? "" : "NO DATA");
    if (rows[0]) dump(rows[0]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
