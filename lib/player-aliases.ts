import { prisma } from "@/lib/prisma";

export type PlayerAliasRow = {
  apiFootballPlayerId: number;
  displayName: string | null;
  photoUrl: string | null;
};

export async function loadUserPlayerAliases(
  userId: string,
  apiFootballPlayerIds: number[]
): Promise<Map<number, PlayerAliasRow>> {
  const ids = [...new Set(apiFootballPlayerIds.filter((n) => Number.isFinite(n)))];
  const map = new Map<number, PlayerAliasRow>();
  if (!ids.length) return map;
  const rows = await prisma.userPlayerAlias.findMany({
    where: { userId, apiFootballPlayerId: { in: ids } },
    select: {
      apiFootballPlayerId: true,
      displayName: true,
      photoUrl: true,
    },
  });
  for (const r of rows) {
    map.set(r.apiFootballPlayerId, {
      apiFootballPlayerId: r.apiFootballPlayerId,
      displayName: r.displayName,
      photoUrl: r.photoUrl,
    });
  }
  return map;
}

/** Upsert display name on the per-user alias (cross-match). */
export async function upsertUserPlayerDisplayName(args: {
  userId: string;
  apiFootballPlayerId: number;
  displayName: string | null;
}) {
  const { userId, apiFootballPlayerId, displayName } = args;
  const existing = await prisma.userPlayerAlias.findUnique({
    where: {
      userId_apiFootballPlayerId: { userId, apiFootballPlayerId },
    },
  });
  if (!displayName && !existing?.photoUrl) {
    if (existing) {
      await prisma.userPlayerAlias.delete({ where: { id: existing.id } });
    }
    return null;
  }
  return prisma.userPlayerAlias.upsert({
    where: {
      userId_apiFootballPlayerId: { userId, apiFootballPlayerId },
    },
    create: {
      userId,
      apiFootballPlayerId,
      displayName,
    },
    update: { displayName },
  });
}
