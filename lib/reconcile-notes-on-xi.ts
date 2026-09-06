/**
 * On Official XI confirm (and XI hash changes while confirmed):
 * 1) Purge entity-linked notes for players no longer in the matchday squad
 * 2) Soft-create Bio notes for confirmed squad players / coaches from existing
 *    Research / profiles pack text (no invented football facts)
 *
 * Never wipes match / club / referee / general research notes.
 * Speaks → Scripts (lineup pack) stays in maybeAutoGenerateLineupPack.
 */

import { prisma } from "./prisma";
import {
  extractPlayerSections,
  splitByHeadings,
  type SquadMember,
} from "./pack-distribute";
import { computeLineupXiHash, resolvePackUserId } from "./pack-generate";
import { namesLooselyMatch, normalizePlayerKey } from "./player-name";

const EXPECTED_XI_HOOK_RE =
  /\b(expected\s+(starting\s+)?xi|predicted\s+xi|your\s+predicted|expected\s+starting\s+xi)\b/i;

export type ReconcileNotesResult = {
  triggered: boolean;
  reason: string;
  purged: number;
  createdPlayers: number;
  createdCoaches: number;
  squadSize: number;
};

/** Matchday squad = starters on pitch + bench (formationSlot BENCH). */
export async function loadConfirmedMatchdaySquad(matchId: string): Promise<{
  match: {
    id: string;
    homeClubId: string;
    awayClubId: string;
    lineupPackXiHash: string | null;
  };
  players: { id: string; name: string; isStarter: boolean; formationSlot: string | null }[];
  coaches: { id: string; name: string; clubId: string }[];
} | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      homeClubId: true,
      awayClubId: true,
      lineupPackXiHash: true,
    },
  });
  if (!match) return null;

  const clubIds = [match.homeClubId, match.awayClubId];
  const players = await prisma.player.findMany({
    where: {
      clubId: { in: clubIds },
      OR: [
        { isStarter: true },
        { onPitch: true },
        { formationSlot: "BENCH" },
      ],
    },
    select: {
      id: true,
      name: true,
      isStarter: true,
      formationSlot: true,
    },
    orderBy: [{ clubId: "asc" }, { shirtNumber: "asc" }],
  });

  const coaches = await prisma.coach.findMany({
    where: { clubId: { in: clubIds } },
    select: { id: true, name: true, clubId: true },
  });

  return { match, players, coaches };
}

async function loadPackCorpus(matchId: string): Promise<string> {
  const sections = await prisma.packSection.findMany({
    where: {
      matchId,
      templateKey: { in: ["research", "profiles", "hooks"] },
    },
    select: { content: true, templateKey: true },
  });
  return sections
    .map((s) => (s.content || "").trim())
    .filter((t) => t.length >= 40)
    .join("\n\n");
}

function extractCoachBodies(
  text: string,
  coaches: { id: string; name: string }[]
): Map<string, string> {
  const out = new Map<string, string>();
  if (!text.trim() || !coaches.length) return out;
  const sections = splitByHeadings(text);
  for (const s of sections) {
    const heading = s.heading || "";
    const body = (s.body || "").trim();
    if (body.length < 40) continue;
    if (
      !/manager|coach|boss|head\s+coach|gaffer/i.test(heading) &&
      !/manager|head\s+coach/i.test(body.slice(0, 120))
    ) {
      // Still allow a heading that is exactly the coach name
      const direct = coaches.find(
        (c) =>
          namesLooselyMatch(heading, c.name) ||
          namesLooselyMatch(heading.replace(/^#+\s*/, ""), c.name)
      );
      if (!direct) continue;
      if (!out.has(direct.id)) out.set(direct.id, body);
      continue;
    }
    for (const c of coaches) {
      if (out.has(c.id)) continue;
      const after = heading.split(/:\s*/).slice(1).join(": ").trim();
      if (
        namesLooselyMatch(heading, c.name) ||
        (after && namesLooselyMatch(after, c.name)) ||
        normalizePlayerKey(`${heading}\n${body.slice(0, 200)}`).includes(
          normalizePlayerKey(c.name)
        )
      ) {
        out.set(c.id, body);
        break;
      }
    }
  }
  return out;
}

/**
 * Purge + soft-create notes when Official XI lands or confirmed XI changes.
 * Fire-and-forget safe — catches its own errors at the call site.
 */
export async function maybeReconcileNotesOnXiConfirm(args: {
  matchId: string;
  previousStatus: string | null | undefined;
  newStatus: string;
}): Promise<ReconcileNotesResult> {
  const { matchId, previousStatus, newStatus } = args;
  if (newStatus !== "confirmed") {
    return {
      triggered: false,
      reason: "not_confirmed",
      purged: 0,
      createdPlayers: 0,
      createdCoaches: 0,
      squadSize: 0,
    };
  }

  const loaded = await loadConfirmedMatchdaySquad(matchId);
  if (!loaded) {
    return {
      triggered: false,
      reason: "missing_match",
      purged: 0,
      createdPlayers: 0,
      createdCoaches: 0,
      squadSize: 0,
    };
  }

  const xiHash = await computeLineupXiHash(matchId);
  const transitioned =
    previousStatus !== "confirmed" && newStatus === "confirmed";
  const xiChanged =
    Boolean(loaded.match.lineupPackXiHash) &&
    Boolean(xiHash) &&
    loaded.match.lineupPackXiHash !== xiHash;
  // Run on confirm transition, XI change, or until lineup pack stamps a hash
  // (proxy for "this Official XI was processed"). Same hash → skip.
  const shouldRun =
    transitioned || xiChanged || !loaded.match.lineupPackXiHash;
  if (!shouldRun) {
    return {
      triggered: false,
      reason: "already_reconciled_same_xi",
      purged: 0,
      createdPlayers: 0,
      createdCoaches: 0,
      squadSize: loaded.players.length,
    };
  }

  const keepIds = new Set(loaded.players.map((p) => p.id));
  const clubIds = [loaded.match.homeClubId, loaded.match.awayClubId];

  // --- PURGE: player-entity notes outside confirmed matchday squad ---
  const playerNotes = await prisma.note.findMany({
    where: { matchId, entityType: "player" },
    select: { id: true, entityId: true },
  });
  const purgePlayerIds = playerNotes
    .filter((n) => n.entityId && !keepIds.has(n.entityId))
    .map((n) => n.id);

  // Expected/predicted-XI specific match hooks that conflict once Official lands
  const matchHooks = await prisma.note.findMany({
    where: {
      matchId,
      category: "Hook",
      OR: [{ entityType: "match" }, { entityType: null }],
    },
    select: { id: true, title: true, body: true },
  });
  const purgeHookIds = matchHooks
    .filter(
      (n) =>
        EXPECTED_XI_HOOK_RE.test(n.title || "") ||
        EXPECTED_XI_HOOK_RE.test(n.body || "")
    )
    .map((n) => n.id);

  const purgeIds = Array.from(new Set([...purgePlayerIds, ...purgeHookIds]));
  let purged = 0;
  if (purgeIds.length) {
    const del = await prisma.note.deleteMany({
      where: { id: { in: purgeIds }, matchId },
    });
    purged = del.count;
  }

  // --- CREATE: Bio notes for squad players / coaches missing notes ---
  const userId = await resolvePackUserId(matchId);
  let createdPlayers = 0;
  let createdCoaches = 0;

  if (userId && loaded.players.length) {
    const corpus = await loadPackCorpus(matchId);
    const squadMembers: SquadMember[] = loaded.players.map((p) => ({
      id: p.id,
      name: p.name,
    }));

    const extracted = corpus
      ? extractPlayerSections(corpus, squadMembers)
      : [];
    const bodyByPlayer = new Map(
      extracted.map((e) => [e.player.id, e.body] as const)
    );

    const existingPlayerNotes = await prisma.note.findMany({
      where: {
        matchId,
        entityType: "player",
        entityId: { in: loaded.players.map((p) => p.id) },
      },
      select: { entityId: true },
    });
    const hasNote = new Set(
      existingPlayerNotes.map((n) => n.entityId).filter(Boolean) as string[]
    );

    for (const p of loaded.players) {
      if (hasNote.has(p.id)) continue;
      const body = bodyByPlayer.get(p.id)?.trim();
      if (!body || body.length < 20) continue; // no invent / no empty placeholder
      try {
        await prisma.note.create({
          data: {
            matchId,
            userId,
            title: `${p.name} — Bio`,
            body,
            category: "Bio",
            entityType: "player",
            entityId: p.id,
            pinned: false,
          },
        });
        createdPlayers += 1;
        hasNote.add(p.id);
      } catch (e) {
        console.error("[reconcile-notes] player create failed", p.id, e);
      }
    }

    // Coaches — only create when research corpus has a manager/coach section
    if (loaded.coaches.length) {
      const coachBodies = extractCoachBodies(corpus, loaded.coaches);
      const existingCoachNotes = await prisma.note.findMany({
        where: {
          matchId,
          entityType: "coach",
          entityId: { in: loaded.coaches.map((c) => c.id) },
        },
        select: { entityId: true },
      });
      const hasCoach = new Set(
        existingCoachNotes.map((n) => n.entityId).filter(Boolean) as string[]
      );

      for (const c of loaded.coaches) {
        if (hasCoach.has(c.id)) continue;
        // Only home/away club coaches (already filtered)
        if (!clubIds.includes(c.clubId)) continue;
        const body = coachBodies.get(c.id)?.trim();
        if (!body || body.length < 40) continue;
        try {
          await prisma.note.create({
            data: {
              matchId,
              userId,
              title: `${c.name} — Coach`,
              body,
              category: "Bio",
              entityType: "coach",
              entityId: c.id,
              pinned: false,
            },
          });
          createdCoaches += 1;
          hasCoach.add(c.id);
        } catch (e) {
          console.error("[reconcile-notes] coach create failed", c.id, e);
        }
      }
    }
  }

  return {
    triggered: true,
    reason: transitioned
      ? "reconciled_on_confirm"
      : xiChanged
        ? "reconciled_on_xi_change"
        : "reconciled_first_confirmed",
    purged,
    createdPlayers,
    createdCoaches,
    squadSize: loaded.players.length,
  };
}
