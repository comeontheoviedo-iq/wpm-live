/** Apply pack section content into Scripts / Notes (shared by generate + distribute). */

import { prisma } from "./prisma";
import {
  emptyDistributed,
  extractClubSections,
  extractPlayerHooks,
  extractPlayerSections,
  type DistributedCounts,
  type SquadMember,
} from "./pack-distribute";

async function upsertEntityNote(args: {
  matchId: string;
  userId: string;
  title: string;
  body: string;
  category: string;
  entityType: string;
  entityId: string;
  pinned?: boolean;
}) {
  const existing = await prisma.note.findFirst({
    where: {
      matchId: args.matchId,
      entityType: args.entityType,
      entityId: args.entityId,
      category: args.category,
    },
  });
  if (existing) {
    await prisma.note.update({
      where: { id: existing.id },
      data: {
        title: args.title,
        body: args.body,
        pinned: args.pinned ?? existing.pinned,
      },
    });
  } else {
    await prisma.note.create({
      data: {
        matchId: args.matchId,
        userId: args.userId,
        title: args.title,
        body: args.body,
        category: args.category,
        entityType: args.entityType,
        entityId: args.entityId,
        pinned: args.pinned ?? false,
      },
    });
  }
}

export type DistributeArgs = {
  matchId: string;
  userId: string;
  templateKey: string;
  templateTitle: string;
  content: string;
  homeClub: { id: string; name: string };
  awayClub: { id: string; name: string };
  allPlayers: SquadMember[];
};

export async function applyPackDistribution(
  args: DistributeArgs
): Promise<DistributedCounts> {
  const distributed = emptyDistributed();
  const {
    matchId,
    userId,
    templateKey,
    templateTitle,
    content,
    homeClub,
    awayClub,
    allPlayers,
  } = args;
  const text = (content || "").trim();
  if (!text) return distributed;

  try {
    if (templateKey === "intro" || templateKey === "lineup") {
      const timing = templateKey === "lineup" ? "kickoff" : "pre-match";
      const existing = await prisma.speak.findFirst({
        where: { matchId, title: templateTitle },
      });
      if (existing) {
        await prisma.speak.update({
          where: { id: existing.id },
          data: { body: text, timing },
        });
      } else {
        await prisma.speak.create({
          data: {
            matchId,
            userId,
            title: templateTitle,
            body: text,
            timing,
            order: templateKey === "lineup" ? 2 : 1,
          },
        });
      }
      distributed.scripts += 1;
    }

    if (templateKey === "hooks") {
      await prisma.note.create({
        data: {
          matchId,
          userId,
          title: "Generated hooks & fillers",
          body: text,
          category: "Hook",
          entityType: "match",
          entityId: matchId,
          pinned: true,
        },
      });
      distributed.matchNotes += 1;

      const playerHooks = extractPlayerHooks(text, allPlayers);
      for (const ph of playerHooks) {
        await upsertEntityNote({
          matchId,
          userId,
          title: ph.title,
          body: ph.body,
          category: "Hook",
          entityType: "player",
          entityId: ph.player.id,
        });
        distributed.playerNotes += 1;
      }
    }

    if (templateKey === "referee") {
      await upsertEntityNote({
        matchId,
        userId,
        title: "Referee",
        body: text,
        category: "Match",
        entityType: "match",
        entityId: matchId,
      });
      distributed.matchNotes += 1;
    }

    if (templateKey === "research") {
      await upsertEntityNote({
        matchId,
        userId,
        title: templateTitle,
        body: text,
        category: "Match",
        entityType: "match",
        entityId: matchId,
      });
      distributed.matchNotes += 1;

      const clubSecs = extractClubSections(text, homeClub, awayClub);
      for (const cs of clubSecs) {
        await upsertEntityNote({
          matchId,
          userId,
          title: cs.title,
          body: cs.body,
          category: "Club",
          entityType: "club",
          entityId: cs.clubId,
        });
        distributed.clubNotes += 1;
      }
    }

    if (templateKey === "profiles") {
      const playerSecs = extractPlayerSections(text, allPlayers);
      for (const ps of playerSecs) {
        await upsertEntityNote({
          matchId,
          userId,
          title: ps.title,
          body: ps.body,
          category: "Bio",
          entityType: "player",
          entityId: ps.player.id,
        });
        distributed.playerNotes += 1;
      }
      if (playerSecs.length < 3) {
        await prisma.note.create({
          data: {
            matchId,
            userId,
            title: "Player profiles pack",
            body: text,
            category: "Bio",
            entityType: "match",
            entityId: matchId,
          },
        });
        distributed.matchNotes += 1;
      }
    }
  } catch (e) {
    console.error("[pack-distribute-apply]", templateKey, e);
    throw e;
  }

  return distributed;
}
