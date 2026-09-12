/**
 * Match-scoped pitch placement overrides.
 * Persist DnD swaps / free-move so AF sync does not wipe commentary placement.
 */
import { prisma } from "./prisma";
import { clampPitchCoord, mirrorPitchCoord } from "./player-overrides";

export type PlacementInput = {
  matchId: string;
  playerId: string;
  formationSlot?: string | null;
  pitchX?: number | null;
  pitchY?: number | null;
  /** When true, clear placement fields only (keep name/flag/jersey). */
  clearPlacement?: boolean;
};

function emptyIdentity(row: {
  displayName: string | null;
  pronunciation: string | null;
  pitchFlag: string | null;
  jerseyNumber: number | null;
}) {
  return (
    !row.displayName &&
    !row.pronunciation &&
    !row.pitchFlag &&
    row.jerseyNumber == null
  );
}

/** Upsert or clear placement fields on MatchPlayerOverride. */
export async function upsertPitchPlacement(input: PlacementInput) {
  const { matchId, playerId } = input;
  const existing = await prisma.matchPlayerOverride.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });

  if (input.clearPlacement) {
    if (!existing) return null;
    if (emptyIdentity(existing)) {
      await prisma.matchPlayerOverride.delete({ where: { id: existing.id } });
      return null;
    }
    return prisma.matchPlayerOverride.update({
      where: { id: existing.id },
      data: { formationSlot: null, pitchX: null, pitchY: null },
    });
  }

  const formationSlot =
    input.formationSlot === undefined
      ? existing?.formationSlot ?? null
      : input.formationSlot
        ? String(input.formationSlot).slice(0, 32)
        : null;
  const pitchX =
    input.pitchX === undefined
      ? existing?.pitchX ?? null
      : clampPitchCoord(input.pitchX);
  const pitchY =
    input.pitchY === undefined
      ? existing?.pitchY ?? null
      : clampPitchCoord(input.pitchY);

  const hasPlacement =
    Boolean(formationSlot) || pitchX != null || pitchY != null;

  if (!hasPlacement && !existing) return null;

  if (!hasPlacement && existing) {
    if (emptyIdentity(existing)) {
      await prisma.matchPlayerOverride.delete({ where: { id: existing.id } });
      return null;
    }
    return prisma.matchPlayerOverride.update({
      where: { id: existing.id },
      data: { formationSlot: null, pitchX: null, pitchY: null },
    });
  }

  return prisma.matchPlayerOverride.upsert({
    where: { matchId_playerId: { matchId, playerId } },
    create: {
      matchId,
      playerId,
      formationSlot,
      pitchX,
      pitchY,
    },
    update: {
      formationSlot,
      pitchX,
      pitchY,
    },
  });
}

/** Clear all pitch placement overrides for a match (Reset official). */
export async function clearAllPitchPlacements(matchId: string) {
  const rows = await prisma.matchPlayerOverride.findMany({ where: { matchId } });
  for (const row of rows) {
    if (emptyIdentity(row)) {
      await prisma.matchPlayerOverride.delete({ where: { id: row.id } });
    } else {
      await prisma.matchPlayerOverride.update({
        where: { id: row.id },
        data: { formationSlot: null, pitchX: null, pitchY: null },
      });
    }
  }
  return { cleared: rows.length };
}

/**
 * After AF lineup sync, re-apply stored slot overrides onto Player rows
 * so commentary DnD survives poll/refresh.
 */
export async function reapplyPitchPlacements(matchId: string) {
  const rows = await prisma.matchPlayerOverride.findMany({
    where: {
      matchId,
      OR: [
        { formationSlot: { not: null } },
        { pitchX: { not: null } },
        { pitchY: { not: null } },
      ],
    },
  });
  if (!rows.length) return { applied: 0 };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { homeClubId: true, awayClubId: true },
  });
  if (!match) return { applied: 0 };

  let applied = 0;
  for (const row of rows) {
    if (!row.formationSlot) continue;
    const player = await prisma.player.findUnique({
      where: { id: row.playerId },
      select: {
        id: true,
        clubId: true,
        formationSlot: true,
        onPitch: true,
        isStarter: true,
      },
    });
    if (!player) continue;
    if (
      player.clubId !== match.homeClubId &&
      player.clubId !== match.awayClubId
    )
      continue;

    // Live subs park leavers on BENCH / off-pitch. Never resurrect them into
    // ST/LW (etc.) from a stale override — that wiped the sub-on and left
    // empty dashed slots on the Venezia–Fiorentina desk.
    if (player.formationSlot === "BENCH") continue;
    if (!player.onPitch && !player.isStarter) continue;

    const occupant = await prisma.player.findFirst({
      where: {
        clubId: player.clubId,
        formationSlot: row.formationSlot,
        NOT: { id: player.id },
        OR: [{ isStarter: true }, { onPitch: true }],
      },
    });
    if (occupant) {
      // Prefer keeping the live occupant when the override player is the same
      // slot already — only swap when both are active on-pitch commentary moves.
      const prev = player.formationSlot;
      if (prev && prev !== row.formationSlot && (player.onPitch || player.isStarter)) {
        await prisma.player.update({
          where: { id: occupant.id },
          data: {
            formationSlot: prev,
            isStarter: true,
            onPitch: true,
          },
        });
      } else if (prev && prev !== row.formationSlot) {
        await prisma.player.update({
          where: { id: occupant.id },
          data: {
            formationSlot: prev,
            isStarter: true,
            onPitch: true,
          },
        });
      } else {
        // Occupant already holds this slot for a live XI — do not clear them
        // just to re-stamp the same override player.
        if (occupant.id !== player.id) {
          continue;
        }
      }
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        formationSlot: row.formationSlot,
        isStarter: true,
        onPitch: true,
      },
    });
    applied++;
  }
  return { applied };
}

/**
 * HT / side-flip: mirror every free-place pitchX/pitchY so manually moved
 * players travel with the teams (official slots already re-layout via homeOnLeft).
 */
export async function mirrorAllFreePlaceCoords(matchId: string) {
  const rows = await prisma.matchPlayerOverride.findMany({
    where: {
      matchId,
      OR: [{ pitchX: { not: null } }, { pitchY: { not: null } }],
    },
  });
  let mirrored = 0;
  for (const row of rows) {
    const pitchX = mirrorPitchCoord(row.pitchX);
    const pitchY = mirrorPitchCoord(row.pitchY);
    if (pitchX === row.pitchX && pitchY === row.pitchY) continue;
    await prisma.matchPlayerOverride.update({
      where: { id: row.id },
      data: { pitchX, pitchY },
    });
    mirrored++;
  }
  return { mirrored };
}

/** Clear slot/coords override when a player is subbed off (keeps name/flag). */
export async function clearPlacementAfterSub(matchId: string, playerId: string) {
  return upsertPitchPlacement({
    matchId,
    playerId,
    clearPlacement: true,
  });
}
