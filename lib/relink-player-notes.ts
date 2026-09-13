/**
 * On desk / notes read: re-attach research bios that landed on the wrong
 * player (shared surname) or never attached (short accented surnames).
 * No invented facts — only research pack text + existing note bodies.
 */

import { prisma } from "./prisma";
import { extractPlayerSections, type SquadMember } from "./pack-distribute";
import { matchSquadPlayer, stripPlayerRoleDecor } from "./player-name";

export type RelinkPlayerNotesResult = {
  scanned: number;
  moved: number;
  created: number;
};

const inflight = new Map<string, Promise<RelinkPlayerNotesResult>>();

export async function relinkPlayerNotesOnRead(
  matchId: string
): Promise<RelinkPlayerNotesResult> {
  const empty: RelinkPlayerNotesResult = { scanned: 0, moved: 0, created: 0 };
  if (!matchId) return empty;
  const existing = inflight.get(matchId);
  if (existing) return existing;

  const run = (async (): Promise<RelinkPlayerNotesResult> => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: matchId },
        select: { id: true, homeClubId: true, awayClubId: true },
      });
      if (!match) return empty;

      const players = await prisma.player.findMany({
        where: { clubId: { in: [match.homeClubId, match.awayClubId] } },
        select: { id: true, name: true },
      });
      if (players.length < 2) return empty;
      const squad: SquadMember[] = players.map((p) => ({ id: p.id, name: p.name }));
      const byId = new Map(squad.map((p) => [p.id, p]));

      const packs = await prisma.packSection.findMany({
        where: {
          matchId,
          templateKey: { in: ["research", "profiles", "hooks"] },
        },
        select: { content: true },
      });
      const corpus = packs
        .map((s) => (s.content || "").trim())
        .filter((t) => t.length >= 40)
        .join("\n\n");

      const notes = await prisma.note.findMany({
        where: { matchId, entityType: "player" },
        select: {
          id: true,
          entityId: true,
          title: true,
          body: true,
          category: true,
          userId: true,
        },
      });

      let moved = 0;
      let created = 0;
      let scanned = notes.length;

      // 1) Existing notes whose first line / title names a different player
      for (const n of notes) {
        const first = (n.body || "").split("\n").find((l) => l.trim()) || "";
        const heading = first || n.title || "";
        const target = matchSquadPlayer(heading, squad) || matchSquadPlayer(
          stripPlayerRoleDecor(n.title || ""),
          squad
        );
        if (!target || !n.entityId || target.id === n.entityId) continue;
        const current = byId.get(n.entityId);
        // Only steal when the current attach is weaker (wrong initial / no name)
        const currentHit = current
          ? matchSquadPlayer(heading, [current])
          : null;
        if (currentHit) continue;
        await prisma.note.update({
          where: { id: n.id },
          data: {
            entityId: target.id,
            title: n.title.includes("—")
              ? `${target.name} — ${n.title.split("—").slice(1).join("—").trim()}`
              : `${target.name} — Bio`,
          },
        });
        moved += 1;
      }

      if (!corpus) {
        return { scanned, moved, created };
      }

      const extracted = extractPlayerSections(corpus, squad);
      scanned += extracted.length;
      const owner = await prisma.note.findFirst({
        where: { matchId, userId: { not: null } },
        select: { userId: true },
      });
      const md = await prisma.match.findUnique({
        where: { id: matchId },
        select: { matchDay: { select: { userId: true } } },
      });
      const userId = owner?.userId || md?.matchDay?.userId || null;

      const fresh = await prisma.note.findMany({
        where: { matchId, entityType: "player" },
        select: { id: true, entityId: true, title: true, body: true, category: true },
      });
      const hasBio = new Set(
        fresh
          .filter((n) => n.category === "Bio" && n.entityId)
          .map((n) => n.entityId as string)
      );

      for (const e of extracted) {
        if (hasBio.has(e.player.id)) continue;
        const body = (e.body || "").trim();
        if (body.length < 20) continue;

        // Move a same-body note sitting on the wrong player
        const orphan = fresh.find(
          (n) =>
            n.entityId !== e.player.id &&
            n.body &&
            (n.body === body ||
              n.body.startsWith(body.slice(0, 80)) ||
              body.startsWith((n.body || "").slice(0, 80)))
        );
        if (orphan) {
          await prisma.note.update({
            where: { id: orphan.id },
            data: {
              entityId: e.player.id,
              title: e.title,
              category: "Bio",
            },
          });
          hasBio.add(e.player.id);
          moved += 1;
          continue;
        }

        if (!userId) continue;
        try {
          await prisma.note.create({
            data: {
              matchId,
              userId,
              title: e.title,
              body,
              category: "Bio",
              entityType: "player",
              entityId: e.player.id,
              pinned: false,
            },
          });
          hasBio.add(e.player.id);
          created += 1;
        } catch (err) {
          console.error("[relink-player-notes] create failed", e.player.id, err);
        }
      }

      return { scanned, moved, created };
    } catch (err) {
      console.error("[relink-player-notes]", matchId, err);
      return empty;
    }
  })();

  inflight.set(matchId, run);
  try {
    return await run;
  } finally {
    inflight.delete(matchId);
  }
}
