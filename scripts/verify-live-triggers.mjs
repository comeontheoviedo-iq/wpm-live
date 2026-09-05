/**
 * Simulate LIVE threshold + game-state note matching against Newcastle FT (1557395).
 * Does not invent UI copy — prints what would flash.
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

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

async function af(path, params) {
  const key = process.env.API_FOOTBALL_KEY;
  const base = process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io";
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${base}${path}?${qs}`, { headers: { "x-apisports-key": key } });
  const j = await res.json();
  return j.response;
}

// Inline minimal copies of trigger logic (avoid TS import)
const DEFAULTS = {
  keyPasses: 3, shotsOn: 3, duelsWon: 6, tackles: 4,
  dribblesSuccess: 3, saves: 3, foulsCommitted: 4, possessionSwing: 12, shotDiff: 6,
};

function evaluate(rows, fired) {
  const defs = [
    ["keyPasses", DEFAULTS.keyPasses, (r) => r.keyPasses, "key passes"],
    ["shotsOn", DEFAULTS.shotsOn, (r) => r.shotsOn, "shots on target"],
    ["duelsWon", DEFAULTS.duelsWon, (r) => r.duelsWon, "duels won"],
    ["tackles", DEFAULTS.tackles, (r) => r.tackles, "tackles"],
    ["dribblesSuccess", DEFAULTS.dribblesSuccess, (r) => r.dribblesSuccess, "dribbles"],
    ["saves", DEFAULTS.saves, (r) => r.saves, "saves"],
    ["foulsCommitted", DEFAULTS.foulsCommitted, (r) => r.foulsCommitted, "fouls"],
  ];
  const out = [];
  for (const r of rows) {
    for (const [stat, thr, pick, label] of defs) {
      const v = pick(r);
      if (v == null || v < thr) continue;
      const id = `thr|${r.afPlayerId}|${stat}|${thr}`;
      if (fired.has(id)) continue;
      fired.add(id);
      out.push({ id, title: `${r.name} · ${v} ${label}`, value: v, team: r.teamName });
    }
  }
  return out;
}

function classify(trigger) {
  const tags = [];
  if (/goal/i.test(trigger.type)) {
    if (trigger.minute <= 20) tags.push("early_goal", "early_concede");
    if (trigger.minute >= 75) tags.push("late_goal", "late_concede");
  }
  return tags;
}

function scoreNotes(notes, tags) {
  const rules = [
    ["early_goal", /score early|early goal|fast start/i],
    ["late_concede", /concede late|late conced|vulnerable late/i],
  ];
  return notes.filter((n) => {
    const hay = `${n.title}\n${n.body}`;
    return tags.some((t) => {
      const rule = rules.find((r) => r[0] === t);
      return rule && rule[1].test(hay);
    });
  });
}

const FIXTURE = 1557395;
(async () => {
  console.log("=== AF inventory NUFC FT", FIXTURE, "===");
  const stats = await af("/fixtures/statistics", { fixture: FIXTURE });
  const labels = [...new Set(stats.flatMap((b) => b.statistics.map((s) => s.type)))];
  console.log("Team stat labels:", labels.join(", "));
  console.log("Has expected_goals?", labels.some((l) => /expect|xg/i.test(l)));
  console.log("Has momentum?", labels.some((l) => /momentum|pressure/i.test(l)));

  const players = await af("/fixtures/players", { fixture: FIXTURE });
  const rows = [];
  for (const t of players) {
    for (const row of t.players) {
      const st = row.statistics?.[0] || {};
      rows.push({
        afPlayerId: row.player.id,
        name: row.player.name,
        teamName: t.team.name,
        keyPasses: st.passes?.key ?? null,
        shotsOn: st.shots?.on ?? null,
        duelsWon: st.duels?.won ?? null,
        tackles: st.tackles?.total ?? null,
        dribblesSuccess: st.dribbles?.success ?? null,
        saves: st.goals?.saves ?? null,
        foulsCommitted: st.fouls?.committed ?? null,
      });
    }
  }
  const fired = new Set();
  const flashes = evaluate(rows, fired);
  console.log("\n=== Threshold flashes (would fire once each) ===");
  for (const f of flashes) console.log("-", f.title, `(${f.team})`);

  // Shot momentum proxy
  const home = stats.find((s) => /newcastle/i.test(s.team.name));
  const away = stats.find((s) => /bournemouth/i.test(s.team.name));
  const hShots = Number(home?.statistics?.find((s) => /Total Shots/i.test(s.type))?.value);
  const aShots = Number(away?.statistics?.find((s) => /Total Shots/i.test(s.type))?.value);
  console.log("\n=== Momentum proxy ===");
  console.log(`Shots ${hShots}–${aShots} (diff ${Math.abs(hShots - aShots)}; threshold 6 →`, Math.abs(hShots - aShots) >= 6 ? "FIRE shot pressure" : "no");

  // Game-state note demo with synthetic notes (not written to DB)
  const demoNotes = [
    { title: "Hook — Spurs early", body: "Spurs love to score early — often within the first 15 minutes." },
    { title: "Team — Bournemouth late", body: "Bournemouth have been vulnerable late and concede late too often." },
  ];
  const early = classify({ type: "goal", minute: 9 });
  const late = classify({ type: "goal", minute: 88 });
  console.log("\n=== Game-state matcher (synthetic notes) ===");
  console.log("9' goal tags:", early, "→", scoreNotes(demoNotes, early).map((n) => n.title));
  console.log("88' goal tags:", late, "→", scoreNotes(demoNotes, late).map((n) => n.title));

  console.log("\n=== Honest gaps ===");
  console.log("- AF: no live momentum field");
  console.log("- AF free: no expected_goals on this fixture");
  console.log("- AF: key passes ≠ labelled chances created");
  console.log("- Per-player live stats: FT reliable; mid-match may lag");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
