/**
 * Manual Official XI: Everton–United from Chris Sofascore paste.
 * AF still empty — apply confirmed boards + benches NOW.
 */
import { PrismaClient } from "@prisma/client";
import { namesLooselyMatch, normalizePlayerKey } from "../lib/player-name";
import { maybeAutoGenerateLineupPack } from "../lib/pack-generate";
import { maybeReconcileNotesOnXiConfirm } from "../lib/reconcile-notes-on-xi";

const prisma = new PrismaClient();
const MATCH_ID = "cmtots5ds011oa69sd8ewl15x";

type Spec = {
  name: string;
  number?: number;
  slot: string;
  captain?: boolean;
};

const EVE_XI: Spec[] = [
  { name: "Pickford", number: 1, slot: "GK" },
  { name: "Rohl", number: 34, slot: "RB" }, // Röhl
  { name: "Tarkowski", number: 6, slot: "RCB", captain: true },
  { name: "Branthwaite", number: 4, slot: "LCB" },
  { name: "Mykolenko", number: 16, slot: "LB" },
  { name: "Armstrong", number: 45, slot: "RDM" },
  { name: "Garner", number: 37, slot: "LDM" },
  { name: "Johnson", number: 22, slot: "RAM" },
  { name: "Dewsbury-Hall", number: 8, slot: "CAM" },
  { name: "George", number: 19, slot: "LAM" },
  { name: "Barry", number: 11, slot: "ST" },
];

const EVE_BENCH: { name: string; number?: number }[] = [
  { name: "Travers", number: 12 },
  { name: "Maitland-Niles" },
  { name: "O'Brien", number: 15 },
  { name: "OBrien", number: 15 },
  { name: "Keane", number: 5 },
  { name: "Alcaraz", number: 24 },
  { name: "Hackney", number: 30 },
  { name: "Graham", number: 58 },
  { name: "Graham" },
  { name: "Grealish" },
  { name: "Dibling", number: 20 },
];

const MUN_XI: Spec[] = [
  { name: "Lammens", number: 1, slot: "GK" },
  { name: "Dalot", number: 2, slot: "RB" },
  { name: "Maguire", number: 5, slot: "RCB" },
  { name: "Martinez", number: 6, slot: "LCB" },
  { name: "Shaw", number: 23, slot: "LB" },
  { name: "Tielemans", number: 18, slot: "RDM" },
  { name: "Mainoo", number: 37, slot: "LDM" },
  { name: "Mbeumo", number: 19, slot: "RAM" },
  { name: "Fernandes", number: 8, slot: "CAM", captain: true },
  { name: "Rashford", number: 9, slot: "LAM" },
  { name: "Cunha", number: 10, slot: "ST" },
];

const MUN_BENCH: { name: string; number?: number }[] = [
  { name: "Darlow", number: 12 },
  { name: "Heaven", number: 26 },
  { name: "Yoro", number: 15 },
  { name: "Mazraoui", number: 3 },
  { name: "Andrey Santos" },
  { name: "Santos" },
  { name: "Mount", number: 7 },
  { name: "Sesko", number: 30 },
  { name: "Šeško", number: 30 },
  { name: "Zirkzee", number: 11 },
  { name: "Dorgu", number: 13 },
];

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"');
}

function matchPlayer(
  players: { id: string; name: string; shirtNumber: number }[],
  spec: { name: string; number?: number }
) {
  const want = decodeHtmlEntities(spec.name);
  const byNumName = players.filter((p) => {
    if (spec.number != null && p.shirtNumber !== spec.number) return false;
    return namesLooselyMatch(decodeHtmlEntities(p.name), want);
  });
  if (byNumName.length === 1) return byNumName[0];
  if (byNumName.length > 1) return byNumName[0];

  if (spec.number != null) {
    const byNum = players.filter((p) => p.shirtNumber === spec.number);
    // Prefer loosely matching name among same number; else unique number
    const loose = byNum.filter((p) =>
      namesLooselyMatch(decodeHtmlEntities(p.name), want)
    );
    if (loose.length === 1) return loose[0];
    if (byNum.length === 1) {
      // Number unique — accept if last token overlaps or number-only bench soft match
      const lastWant = normalizePlayerKey(want).split(" ").filter(Boolean).pop();
      const lastHave = normalizePlayerKey(decodeHtmlEntities(byNum[0].name))
        .split(" ")
        .filter(Boolean)
        .pop();
      if (lastWant && lastHave && (lastWant === lastHave || lastHave.includes(lastWant) || lastWant.includes(lastHave))) {
        return byNum[0];
      }
      // O'Brien special: number 15 unique-ish with O in name
      if (
        /obrien|o brien|o&apos;brien/i.test(normalizePlayerKey(decodeHtmlEntities(byNum[0].name)).replace(/\s/g, "")) ||
        /obrien|o brien/i.test(normalizePlayerKey(want).replace(/\s/g, ""))
      ) {
        return byNum[0];
      }
    }
  }

  const byName = players.filter((p) =>
    namesLooselyMatch(decodeHtmlEntities(p.name), want)
  );
  if (byName.length === 1) return byName[0];
  if (byName.length > 1 && spec.number != null) {
    return byName.find((p) => p.shirtNumber === spec.number) || byName[0];
  }
  if (byName.length > 1) return byName[0];

  // HTML-entity O'Brien: last token brien + number 15
  if (spec.number != null) {
    const wantKey = normalizePlayerKey(want).replace(/\s/g, "");
    const candidates = players.filter((p) => p.shirtNumber === spec.number);
    for (const p of candidates) {
      const have = normalizePlayerKey(decodeHtmlEntities(p.name)).replace(/\s/g, "");
      if (have.includes("brien") && wantKey.includes("brien")) return p;
      if (have.includes("santos") && wantKey.includes("santos")) return p;
    }
  }

  // Santos / Andrey Santos full name contains
  const wantNorm = normalizePlayerKey(want);
  const contains = players.filter((p) => {
    const n = normalizePlayerKey(decodeHtmlEntities(p.name));
    return n.includes(wantNorm) || wantNorm.includes(n);
  });
  if (contains.length === 1) return contains[0];

  return null;
}

async function applySide(
  clubId: string,
  xi: Spec[],
  benchSpecs: { name: string; number?: number }[],
  label: string
) {
  const players = await prisma.player.findMany({ where: { clubId } });
  const unmatched: string[] = [];
  const matchedXi: { playerId: string; formationSlot: string; name: string; number: number }[] = [];
  const matchedBenchIds = new Set<string>();
  const matchedBenchNames: string[] = [];

  // Clear all pitch / squad flags for club
  await prisma.player.updateMany({
    where: { clubId },
    data: { isStarter: false, onPitch: false, formationSlot: null, isCaptain: false },
  });

  for (const spec of xi) {
    const p = matchPlayer(players, spec);
    if (!p) {
      unmatched.push(`${label} XI: ${spec.number ?? "?"} ${spec.name}`);
      continue;
    }
    await prisma.player.update({
      where: { id: p.id },
      data: {
        isStarter: true,
        onPitch: true,
        formationSlot: spec.slot,
        isCaptain: Boolean(spec.captain),
        ...(spec.number != null ? { shirtNumber: spec.number } : {}),
      },
    });
    matchedXi.push({
      playerId: p.id,
      formationSlot: spec.slot,
      name: p.name,
      number: spec.number ?? p.shirtNumber,
    });
  }

  const seenBenchKeys = new Set<string>();
  for (const spec of benchSpecs) {
    const key = `${spec.number ?? ""}|${normalizePlayerKey(spec.name)}`;
    // Deduplicate alternate spellings once matched
    const p = matchPlayer(players, spec);
    if (!p) {
      // Only report once per logical name (skip alt spellings that also miss)
      if (!seenBenchKeys.has(normalizePlayerKey(spec.name).split(" ").pop() || spec.name)) {
        // defer reporting after we know if any alt matched
      }
      unmatched.push(`${label} bench: ${spec.number ?? "?"} ${spec.name}`);
      continue;
    }
    if (matchedBenchIds.has(p.id)) continue;
    // Don't put a starter on the bench
    if (matchedXi.some((m) => m.playerId === p.id)) continue;
    matchedBenchIds.add(p.id);
    matchedBenchNames.push(`${p.shirtNumber} ${p.name}`);
    await prisma.player.update({
      where: { id: p.id },
      data: {
        isStarter: false,
        onPitch: false,
        formationSlot: "BENCH",
        ...(spec.number != null && players.find((x) => x.id === p.id)?.shirtNumber === spec.number
          ? {}
          : {}),
      },
    });
  }

  // Soft-unmatched: if any alt spelling of same surname matched, drop duplicate miss reports
  const matchedSurnames = new Set(
    matchedBenchNames.map((n) => normalizePlayerKey(n).split(" ").pop() || "")
  );
  const filteredUnmatched = unmatched.filter((u) => {
    if (!u.includes("bench:")) return true;
    const bits = u.split(" ").pop() || "";
    const sur = normalizePlayerKey(bits).split(" ").pop() || "";
    return !matchedSurnames.has(sur);
  });

  return { matchedXi, matchedBenchNames, unmatched: filteredUnmatched };
}

async function main() {
  const match = await prisma.match.findUnique({ where: { id: MATCH_ID } });
  if (!match) throw new Error("Match not found: " + MATCH_ID);
  const previousStatus = match.lineupStatus;

  console.log("Previous lineupStatus:", previousStatus);

  const home = await applySide(match.homeClubId, EVE_XI, EVE_BENCH, "Everton");
  const away = await applySide(match.awayClubId, MUN_XI, MUN_BENCH, "Man United");

  const predictedHomeJson = JSON.stringify(
    home.matchedXi.map((m) => ({ playerId: m.playerId, formationSlot: m.formationSlot }))
  );
  const predictedAwayJson = JSON.stringify(
    away.matchedXi.map((m) => ({ playerId: m.playerId, formationSlot: m.formationSlot }))
  );

  const updated = await prisma.match.update({
    where: { id: MATCH_ID },
    data: {
      homeFormation: "4-2-3-1",
      awayFormation: "4-2-3-1",
      lineupStatus: "confirmed",
      predictedHomeJson,
      predictedAwayJson,
    },
  });

  console.log("\n=== Everton starters ===");
  for (const m of home.matchedXi) console.log(`  ${m.slot.padEnd(4)} #${m.number} ${m.name}`);
  console.log("Everton bench:", home.matchedBenchNames.join(", ") || "(none)");

  console.log("\n=== Man United starters ===");
  for (const m of away.matchedXi) console.log(`  ${m.slot.padEnd(4)} #${m.number} ${m.name}`);
  console.log("Man United bench:", away.matchedBenchNames.join(", ") || "(none)");

  const unmatched = [...home.unmatched, ...away.unmatched];
  // Dedupe O'Brien / OBrien / Sesko alts that failed
  const uniqUnmatched = [...new Set(unmatched)];
  console.log("\nUnmatched:", uniqUnmatched.length ? uniqUnmatched : "(none)");
  console.log("lineupStatus:", updated.lineupStatus);
  console.log("formations:", updated.homeFormation, "/", updated.awayFormation);

  // Trigger pack + note reconcile (safe on confirm flip)
  console.log("\nTriggering maybeAutoGenerateLineupPack…");
  const pack = await maybeAutoGenerateLineupPack({
    matchId: MATCH_ID,
    previousStatus,
    newStatus: "confirmed",
  });
  console.log("pack:", pack);

  console.log("Triggering maybeReconcileNotesOnXiConfirm…");
  const notes = await maybeReconcileNotesOnXiConfirm({
    matchId: MATCH_ID,
    previousStatus,
    newStatus: "confirmed",
  });
  console.log("notes:", {
    triggered: notes.triggered,
    reason: notes.reason,
    purged: notes.purged,
    createdPlayers: notes.createdPlayers,
    createdCoaches: notes.createdCoaches,
    squadSize: notes.squadSize,
  });

  // Verify sample
  const starters = await prisma.player.findMany({
    where: {
      clubId: { in: [match.homeClubId, match.awayClubId] },
      isStarter: true,
    },
    orderBy: [{ clubId: "asc" }, { formationSlot: "asc" }],
    select: {
      name: true,
      shirtNumber: true,
      formationSlot: true,
      onPitch: true,
      isCaptain: true,
      clubId: true,
    },
  });
  console.log("\n=== VERIFY starters onPitch ===");
  for (const p of starters) {
    console.log(
      `${p.clubId === match.homeClubId ? "EVE" : "MUN"} ${String(p.formationSlot).padEnd(4)} #${p.shirtNumber} ${p.name}${p.isCaptain ? " (C)" : ""} pitch=${p.onPitch}`
    );
  }
  console.log("starter count:", starters.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
