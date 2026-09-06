/**
 * One-shot / on-load rechunk: League-bucket notes with body > maxChars
 * become short air cards. Preserves the original note id for the first
 * chunk so relevance / OBS wiring is not broken.
 */
import { prisma } from "./prisma";
import {
  isLeagueBucketFatNote,
  LEAGUE_NOTE_MAX_CHARS,
  packBodyToCards,
} from "./pack-chunker";

export type RechunkResult = {
  scanned: number;
  split: number;
  created: number;
  softFail?: string;
};

/** Per-match in-flight guard — avoids double-split races on parallel loads. */
const inflight = new Map<string, Promise<RechunkResult>>();

export async function rechunkOverlongLeagueNotes(
  matchId: string,
  maxChars = LEAGUE_NOTE_MAX_CHARS
): Promise<RechunkResult> {
  const empty: RechunkResult = { scanned: 0, split: 0, created: 0 };
  if (!matchId) return empty;

  const existing = inflight.get(matchId);
  if (existing) return existing;

  const run = (async (): Promise<RechunkResult> => {
    try {
      const notes = await prisma.note.findMany({
        where: { matchId },
        orderBy: { createdAt: "asc" },
      });
      let split = 0;
      let created = 0;
      let scanned = 0;

      for (const n of notes) {
        if (!isLeagueBucketFatNote(n)) continue;
        if (!n.body || n.body.length <= maxChars) continue;
        scanned += 1;

        // Re-read — another worker may have already sliced this id
        const fresh = await prisma.note.findUnique({ where: { id: n.id } });
        if (!fresh?.body || fresh.body.length <= maxChars) continue;

        const cards = packBodyToCards(fresh.title, fresh.body, maxChars);
        if (cards.length <= 1) {
          if (cards[0] && cards[0].body.length < fresh.body.length) {
            await prisma.note.update({
              where: { id: fresh.id },
              data: { title: cards[0].title, body: cards[0].body },
            });
            split += 1;
          }
          continue;
        }

        await prisma.note.update({
          where: { id: fresh.id },
          data: { title: cards[0].title, body: cards[0].body },
        });
        split += 1;

        for (let i = 1; i < cards.length; i++) {
          // Skip if an identical sibling already exists (race / repeat)
          const dup = await prisma.note.findFirst({
            where: {
              matchId: fresh.matchId,
              entityType: fresh.entityType,
              entityId: fresh.entityId,
              title: cards[i].title,
              body: cards[i].body,
            },
          });
          if (dup) continue;
          await prisma.note.create({
            data: {
              matchId: fresh.matchId,
              userId: fresh.userId,
              title: cards[i].title,
              body: cards[i].body,
              category: fresh.category,
              entityType: fresh.entityType,
              entityId: fresh.entityId,
              pinned: false,
            },
          });
          created += 1;
        }
      }

      return { scanned, split, created };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ...empty, softFail: msg };
    } finally {
      inflight.delete(matchId);
    }
  })();

  inflight.set(matchId, run);
  return run;
}
