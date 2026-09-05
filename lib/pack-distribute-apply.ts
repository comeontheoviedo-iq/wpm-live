/** Apply pack section content into Scripts / Notes (shared by generate + distribute). */

import { prisma } from "./prisma";
import {
  emptyDistributed,
  extractPlayerHooks,
  extractPlayerSections,
  type DistributedCounts,
  type SquadMember,
} from "./pack-distribute";
import {
  looksLikeNotebookPack,
  organiseNotebookPack,
  splitHookBullets,
  type CoachMember,
} from "./notebook-organise";

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
  // Key on title + entity — Research / Referee / Must-mention share match entity.
  const existing = await prisma.note.findFirst({
    where: {
      matchId: args.matchId,
      entityType: args.entityType,
      entityId: args.entityId,
      title: args.title,
    },
  });
  if (existing) {
    await prisma.note.update({
      where: { id: existing.id },
      data: {
        title: args.title,
        body: args.body,
        category: args.category,
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

async function upsertSpeak(args: {
  matchId: string;
  userId: string;
  title: string;
  body: string;
  timing: string;
  order: number;
}) {
  const existing = await prisma.speak.findFirst({
    where: { matchId: args.matchId, title: args.title },
  });
  if (existing) {
    await prisma.speak.update({
      where: { id: existing.id },
      data: { body: args.body, timing: args.timing, order: args.order },
    });
  } else {
    await prisma.speak.create({
      data: {
        matchId: args.matchId,
        userId: args.userId,
        title: args.title,
        body: args.body,
        timing: args.timing,
        order: args.order,
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
  coaches?: CoachMember[];
  /** Optional: store full paste as archive note. Default false (split-first). */
  keepFullArchive?: boolean;
};

function tallyFromNotes(
  distributed: DistributedCounts,
  note: { category: string; entityType: string; title: string }
) {
  if (note.category === "Hook") {
    distributed.hookNotes += 1;
    return;
  }
  if (note.entityType === "player") {
    distributed.playerNotes += 1;
    return;
  }
  if (note.entityType === "coach") {
    distributed.coachNotes += 1;
    return;
  }
  if (note.entityType === "club") {
    distributed.clubNotes += 1;
    return;
  }
  distributed.matchNotes += 1;
}

async function applyOrganised(
  args: DistributeArgs,
  coaches: CoachMember[]
): Promise<DistributedCounts> {
  const distributed = emptyDistributed();
  const organised = organiseNotebookPack({
    text: args.content,
    matchId: args.matchId,
    homeClub: args.homeClub,
    awayClub: args.awayClub,
    players: args.allPlayers,
    coaches,
    keepFullArchive: args.keepFullArchive === true,
  });

  for (const n of organised.notes) {
    await upsertEntityNote({
      matchId: args.matchId,
      userId: args.userId,
      title: n.title,
      body: n.body,
      category: n.category,
      entityType: n.entityType,
      entityId: n.entityId,
      pinned: n.pinned,
    });
    tallyFromNotes(distributed, n);
  }

  for (const s of organised.speaks) {
    await upsertSpeak({
      matchId: args.matchId,
      userId: args.userId,
      title: s.title,
      body: s.body,
      timing: s.timing,
      order: s.order,
    });
    distributed.scripts += 1;
    if (/intro/i.test(s.title)) distributed.intro += 1;
    if (/lineup/i.test(s.title)) distributed.lineup += 1;
  }

  return distributed;
}

/** Distribute bite-sized hooks from a hooks pack (not one wall of text). */
async function distributeHooksPack(
  args: DistributeArgs
): Promise<DistributedCounts> {
  const distributed = emptyDistributed();
  const text = args.content.trim();
  const items = splitHookBullets(text);

  if (items.length >= 3) {
    for (const h of items.slice(0, 24)) {
      await upsertEntityNote({
        matchId: args.matchId,
        userId: args.userId,
        title: h.title,
        body: h.body,
        category: "Hook",
        entityType: "match",
        entityId: args.matchId,
        pinned: true,
      });
      distributed.hookNotes += 1;
    }
  } else {
    // Fallback single pinned note only when we can't split
    await upsertEntityNote({
      matchId: args.matchId,
      userId: args.userId,
      title: "Generated hooks & fillers",
      body: text,
      category: "Hook",
      entityType: "match",
      entityId: args.matchId,
      pinned: true,
    });
    distributed.hookNotes += 1;
  }

  const playerHooks = extractPlayerHooks(text, args.allPlayers);
  for (const ph of playerHooks) {
    await upsertEntityNote({
      matchId: args.matchId,
      userId: args.userId,
      title: ph.title,
      body: ph.body,
      category: "Hook",
      entityType: "player",
      entityId: ph.player.id,
    });
    distributed.playerNotes += 1;
  }

  return distributed;
}

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

  const coaches: CoachMember[] = args.coaches || [];

  try {
    // Research pack OR any mega Notebook paste → smart organise (split-first)
    if (
      templateKey === "research" ||
      (looksLikeNotebookPack(text) &&
        !["intro", "lineup", "referee"].includes(templateKey))
    ) {
      return await applyOrganised(args, coaches);
    }

    if (templateKey === "intro" || templateKey === "lineup") {
      const timing = templateKey === "lineup" ? "kickoff" : "pre-match";
      await upsertSpeak({
        matchId,
        userId,
        title: templateTitle,
        body: text,
        timing,
        order: templateKey === "lineup" ? 2 : 1,
      });
      distributed.scripts += 1;
      if (templateKey === "intro") distributed.intro += 1;
      if (templateKey === "lineup") distributed.lineup += 1;
      return distributed;
    }

    if (templateKey === "hooks") {
      return await distributeHooksPack(args);
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
      return distributed;
    }

    if (templateKey === "profiles") {
      if (looksLikeNotebookPack(text)) {
        return await applyOrganised(args, coaches);
      }
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
        await upsertEntityNote({
          matchId,
          userId,
          title: "Player profiles pack",
          body: text,
          category: "Bio",
          entityType: "match",
          entityId: matchId,
        });
        distributed.matchNotes += 1;
      }
      return distributed;
    }

    // Unknown / custom section: if Notebook-shaped, organise; else land pinned match note
    if (looksLikeNotebookPack(text)) {
      return await applyOrganised(args, coaches);
    }

    await upsertEntityNote({
      matchId,
      userId,
      title: templateTitle || templateKey,
      body: text,
      category: "Match",
      entityType: "match",
      entityId: matchId,
      pinned: true,
    });
    distributed.matchNotes += 1;
  } catch (e) {
    console.error("[pack-distribute-apply]", templateKey, e);
    throw e;
  }

  return distributed;
}

