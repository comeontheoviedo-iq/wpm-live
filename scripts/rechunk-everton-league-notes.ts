/**
 * One-shot: rechunk over-long League / Table&form notes for Everton–United.
 */
import { PrismaClient } from "@prisma/client";
import { rechunkOverlongLeagueNotes } from "../lib/rechunk-league-notes";
import { isLeagueBucketFatNote, LEAGUE_NOTE_MAX_CHARS } from "../lib/pack-chunker";

const p = new PrismaClient();
const MATCH = "cmtots5ds011oa69sd8ewl15x";

async function main() {
  const beforeAll = await p.note.count({ where: { matchId: MATCH } });
  const beforeFat = await p.note.findMany({
    where: { matchId: MATCH },
    select: { id: true, title: true, entityType: true, body: true },
  });
  const fat = beforeFat.filter(
    (n) => isLeagueBucketFatNote(n) && (n.body?.length || 0) > LEAGUE_NOTE_MAX_CHARS
  );
  console.log(
    "BEFORE",
    JSON.stringify(
      {
        total: beforeAll,
        fatCount: fat.length,
        fat: fat.map((n) => ({
          id: n.id,
          title: n.title,
          entityType: n.entityType,
          len: n.body.length,
        })),
      },
      null,
      2
    )
  );

  const result = await rechunkOverlongLeagueNotes(MATCH);
  console.log("RESULT", result);

  const afterAll = await p.note.count({ where: { matchId: MATCH } });
  const after = await p.note.findMany({
    where: { matchId: MATCH },
    select: { id: true, title: true, entityType: true, body: true },
  });
  const stillFat = after.filter(
    (n) => isLeagueBucketFatNote(n) && (n.body?.length || 0) > LEAGUE_NOTE_MAX_CHARS
  );
  const leagueish = after.filter((n) => isLeagueBucketFatNote(n));
  console.log(
    "AFTER",
    JSON.stringify(
      {
        total: afterAll,
        leagueBucketNotes: leagueish.length,
        stillFat: stillFat.map((n) => ({
          title: n.title,
          len: n.body.length,
        })),
        sample: leagueish.slice(0, 12).map((n) => ({
          title: n.title,
          len: n.body.length,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
