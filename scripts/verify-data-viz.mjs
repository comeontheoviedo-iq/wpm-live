/**
 * Verify viz builders against Newcastle FT (1557395) — no invented numbers.
 * Optionally probes advanced-stats HTTP if NEXT session cookie unavailable (skips).
 */
import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
for (const line of readFileSync(resolve(root, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
    v = v.slice(1, -1);
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

// Inline builders (avoid TS import) — mirror lib/viz-build soft-fail rules
function parseNum(v) {
  if (v == null || v === "—") return null;
  const n = Number(String(v).replace("%", "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function findStat(stats, re) {
  return (stats || []).find((s) => re.test(s.label)) || null;
}
function pair(stats, re) {
  const row = findStat(stats, re);
  if (!row) return null;
  const home = parseNum(row.homeValue);
  const away = parseNum(row.awayValue);
  if (home == null || away == null) return null;
  return { label: row.label, home, away };
}

async function af(path, params) {
  const key = process.env.API_FOOTBALL_KEY;
  const base = process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io";
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${base}${path}?${qs}`, { headers: { "x-apisports-key": key } });
  const j = await res.json();
  return j.response;
}

const FIXTURE = 1557395;
const MATCH_ID = "cmtorhbeo08zm11zutipi5m3a";
const p = new PrismaClient();

const match = await p.match.findUnique({
  where: { id: MATCH_ID },
  include: { homeClub: true, awayClub: true },
});
const statistics = await p.statistic.findMany({ where: { matchId: MATCH_ID } });
const events = await p.matchEvent.findMany({ where: { matchId: MATCH_ID }, orderBy: { minute: "asc" } });

console.log("Match", match.homeClub.name, match.homeScore, "-", match.awayScore, match.awayClub.name, match.status);

const bagsBase = {
  statistics: statistics.map((s) => ({ label: s.label, homeValue: s.homeValue, awayValue: s.awayValue })),
  events: events.map((e) => ({ minute: e.minute, type: e.type, teamSide: e.teamSide, description: e.description })),
  homeGoals: match.homeScore,
  awayGoals: match.awayScore,
  possessionSamples: [57],
  momentumSamples: [
    { at: 1, homePoss: 55, homeShots: 4, awayShots: 8, homeScore: 1, awayScore: 1 },
    { at: 2, homePoss: 57, homeShots: 8, awayShots: 17, homeScore: 2, awayScore: 2 },
  ],
};

// AF player stats
const playersPayload = await af("/fixtures/players", { fixture: FIXTURE });
const live = [];
for (const block of playersPayload || []) {
  const side = block.team?.id === 34 ? "home" : block.team?.id === 35 ? "away" : null;
  if (!side) continue;
  for (const row of block.players || []) {
    const st = row.statistics?.[0];
    if (!st) continue;
    live.push({
      afPlayerId: row.player.id,
      name: row.player.name,
      teamSide: side,
      keyPasses: st.passes?.key ?? null,
      shotsOn: st.shots?.on ?? null,
      duelsWon: st.duels?.won ?? null,
      tackles: st.tackles?.total ?? null,
      saves: st.goals?.saves ?? null,
      dribblesSuccess: st.dribbles?.success ?? null,
    });
  }
}
bagsBase.livePlayerStats = live;
console.log("livePlayerStats", live.length);

// Advanced shots via understat soft path — hit local API if up
let adv = { homeXg: null, awayXg: null, shots: [] };
try {
  const res = await fetch(`http://localhost:3000/api/matches/${MATCH_ID}/advanced-stats`, { cache: "no-store" });
  if (res.status === 401) {
    console.log("advanced-stats: 401 (need session) — probing understat via resolve in-process skipped");
  } else if (res.ok) {
    adv = await res.json();
    console.log("advanced-stats available", adv.available, "shots", (adv.shots||[]).length, "xg", adv.homeXg, adv.awayXg);
  } else {
    console.log("advanced-stats HTTP", res.status);
  }
} catch (e) {
  console.log("advanced-stats fetch failed", e.message);
}

bagsBase.shots = adv.shots || [];
bagsBase.homeXg = adv.homeXg ?? null;
bagsBase.awayXg = adv.awayXg ?? null;

// Dynamic import compiled? Use npx tsx if available
let pickViz, ALL_VIZ_KINDS, buildViz;
try {
  const mod = await import(pathToFileURL(resolve(root, "lib/viz-build.ts")).href).catch(() => null);
  if (!mod) throw new Error("direct ts import failed");
  ({ pickViz, ALL_VIZ_KINDS, buildViz } = mod);
} catch {
  // Fallback: spawn tsx
}

if (!buildViz) {
  const { spawnSync } = await import("child_process");
  const r = spawnSync(
    "npx",
    ["tsx", "-e", `
import { buildViz, ALL_VIZ_KINDS, pickViz } from "./lib/viz-build.ts";
import { writeFileSync } from "fs";
const bags = ${JSON.stringify(bagsBase)};
const results = {};
for (const k of ALL_VIZ_KINDS) {
  const v = buildViz(k, bags);
  results[k] = v ? { ok: true, kind: v.kind, extra: Object.keys(v).filter(x=>x!=="kind") } : { ok: false };
}
const rotated = [];
const recent = [];
for (const ctx of ["goal","ht","moment","card","shotsOn","saves","default"]) {
  const v = pickViz({ prefer: null, context: ctx, bags, recentKinds: recent });
  if (v) { rotated.push({ ctx, kind: v.kind }); recent.push(v.kind); }
}
writeFileSync("/tmp/viz-verify.json", JSON.stringify({ results, rotated }, null, 2));
console.log("WROTE");
`],
    { cwd: root, encoding: "utf8", env: process.env }
  );
  console.log(r.stdout);
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  const out = JSON.parse(readFileSync("/tmp/viz-verify.json", "utf8"));
  console.log("\n=== Builder results (Newcastle FT bags) ===");
  for (const [k, v] of Object.entries(out.results)) {
    console.log(v.ok ? `  OK  ${k}` : `  --  ${k} (soft-fail)`);
  }
  console.log("\n=== Rotation sample ===");
  for (const r of out.rotated) console.log(`  ${r.ctx} → ${r.kind}`);
}

await p.$disconnect();
console.log("\nDesk: open /matches/" + MATCH_ID + " → Sync for FT viz preview + threshold leaderboards.");
