/**
 * Documents + lightly exercises auto-lineup trigger dedup rules.
 * Does not call Gemini — only hash / status gating helpers where possible.
 */
import { PrismaClient } from "@prisma/client";
import { computeLineupXiHash } from "../lib/pack-generate";

const prisma = new PrismaClient();
const MATCH_ID = process.env.MATCH_ID || "cmto7ma85000610otexazyf6k";

async function main() {
  const match = await prisma.match.findUnique({
    where: { id: MATCH_ID },
    select: {
      id: true,
      lineupStatus: true,
      lineupPackGeneratedAt: true,
      lineupPackXiHash: true,
    },
  });
  if (!match) {
    console.log("Match not found", MATCH_ID);
    return;
  }
  const hash = await computeLineupXiHash(MATCH_ID);
  console.log("match", match.id);
  console.log("lineupStatus", match.lineupStatus);
  console.log("lineupPackGeneratedAt", match.lineupPackGeneratedAt);
  console.log("storedXiHash", match.lineupPackXiHash);
  console.log("currentXiHash", hash.slice(0, 80) + (hash.length > 80 ? "…" : ""));
  console.log("hashMatch", match.lineupPackXiHash === hash);

  // Logic summary (mirrors maybeAutoGenerateLineupPack):
  // 1) newStatus !== confirmed → skip
  // 2) previous !== confirmed && new === confirmed → generate
  // 3) already confirmed + same XI hash + generatedAt → skip
  // 4) already confirmed + XI changed → regenerate
  console.log("\nRules:");
  console.log("- If already confirmed and same XI → skip (no regen every sync)");
  console.log("- If transition → confirmed → generate lineup pack");
  console.log("- If confirmed and XI hash changed → regenerate");

  if (match.lineupStatus === "confirmed" && match.lineupPackGeneratedAt && match.lineupPackXiHash === hash) {
    console.log("\nWould SKIP on next sync (already generated, same XI)");
  } else if (match.lineupStatus === "confirmed" && !match.lineupPackGeneratedAt) {
    console.log("\nWould GENERATE on next sync (confirmed, never packed)");
  } else if (match.lineupStatus === "confirmed" && match.lineupPackXiHash !== hash) {
    console.log("\nWould REGENERATE on next sync (XI changed)");
  } else {
    console.log("\nWould SKIP (not confirmed)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
