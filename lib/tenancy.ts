/**
 * Personal-account tenancy: match desks and notes are scoped to session.userId.
 *
 * Demo: seed user `demo@pitchline.app` is a normal owner — filter by userId.
 * Shared demo desks = shared demo login (same userId), not a cross-user ACL.
 * Legacy rows with userId null are hidden and inaccessible until reassigned.
 */

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export const DEMO_EMAIL = "demo@pitchline.app";

export function isDemoEmail(email: string | null | undefined): boolean {
  return String(email || "").trim().toLowerCase() === DEMO_EMAIL;
}

/** Prisma where for MatchDay lists owned by this session. */
export function matchDayOwnerWhere(userId: string) {
  return { userId };
}

export function ownsMatchDay(
  matchDay: { userId: string | null },
  userId: string
): boolean {
  return matchDay.userId === userId;
}

export async function findOwnedMatchDay(id: string, userId: string) {
  return prisma.matchDay.findFirst({
    where: { id, userId },
    select: { id: true, userId: true, title: true },
  });
}

/** Match must belong to a MatchDay owned by userId. */
export async function findOwnedMatch(matchId: string, userId: string) {
  return prisma.match.findFirst({
    where: { id: matchId, matchDay: { userId } },
    select: {
      id: true,
      matchDayId: true,
      matchDay: { select: { id: true, userId: true } },
    },
  });
}

export async function assertMatchOwned(
  matchId: string,
  user: SessionUser
): Promise<{ ok: true } | { ok: false; status: 403 | 404; error: string }> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, matchDay: { select: { userId: true } } },
  });
  if (!match) return { ok: false, status: 404, error: "Not found" };
  if (!ownsMatchDay(match.matchDay, user.id)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true };
}

export async function findOwnedNote(noteId: string, userId: string) {
  return prisma.note.findFirst({
    where: {
      id: noteId,
      OR: [
        { userId },
        { match: { matchDay: { userId } } },
      ],
    },
  });
}

export async function findOwnedSpeak(speakId: string, userId: string) {
  return prisma.speak.findFirst({
    where: {
      id: speakId,
      OR: [
        { userId },
        { match: { matchDay: { userId } } },
      ],
    },
  });
}
