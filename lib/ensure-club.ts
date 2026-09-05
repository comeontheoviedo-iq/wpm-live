import type { Club, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type EnsureClubInput = {
  /** Existing Pitchline club id (cuid), if known */
  id?: string | null;
  name?: string | null;
  shortName?: string | null;
  abbreviation?: string | null;
  apiFootballTeamId?: number | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  badgeEmoji?: string | null;
  city?: string | null;
};

function parseAfTeamId(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

/**
 * Resolve or create a Club from a desk form / API-Football selection.
 * Prefer apiFootballTeamId, then id, then exact name. Never invents names
 * without an AF id or existing id — returns null if nothing usable.
 */
export async function ensureClub(
  db: Db,
  input: EnsureClubInput
): Promise<Club | null> {
  const afTeamId = parseAfTeamId(input.apiFootballTeamId);
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const shortName = String(input.shortName || name || "").trim();

  if (afTeamId !== null) {
    const byAf = await db.club.findFirst({
      where: { apiFootballTeamId: afTeamId },
    });
    if (byAf) {
      // Optionally attach a clearer name if the row was a stub
      if (name && byAf.name !== name && byAf.name.length < 3) {
        return db.club.update({
          where: { id: byAf.id },
          data: { name, shortName: shortName || byAf.shortName },
        });
      }
      return byAf;
    }
  }

  if (id) {
    const byId = await db.club.findUnique({ where: { id } });
    if (byId) {
      if (afTeamId !== null && byId.apiFootballTeamId == null) {
        return db.club.update({
          where: { id: byId.id },
          data: { apiFootballTeamId: afTeamId },
        });
      }
      return byId;
    }
    // Form sometimes echoed AF numeric ids into homeClubId before ensure ran
    if (/^\d+$/.test(id)) {
      const asAf = Number(id);
      const byAf = await db.club.findFirst({
        where: { apiFootballTeamId: asAf },
      });
      if (byAf) return byAf;
    }
  }

  if (name) {
    const byName = await db.club.findFirst({ where: { name: { equals: name } } });
    if (byName) {
      if (afTeamId !== null && byName.apiFootballTeamId == null) {
        return db.club.update({
          where: { id: byName.id },
          data: { apiFootballTeamId: afTeamId },
        });
      }
      return byName;
    }
  }

  // Create only when we have a name (from AF selection or manual ensure)
  if (!name) return null;

  const abbreviation = String(
    input.abbreviation || shortName.slice(0, 3).toUpperCase() || "CLB"
  );

  try {
    return await db.club.create({
      data: {
        name,
        shortName: shortName || name,
        abbreviation,
        primaryColor: input.primaryColor || "#0d9488",
        secondaryColor: input.secondaryColor || "#f0fdfa",
        badgeEmoji: input.badgeEmoji || "⚽",
        city: input.city || null,
        apiFootballTeamId: afTeamId,
      },
    });
  } catch {
    // Race: another request created the same AF team / name
    if (afTeamId !== null) {
      const existing = await db.club.findFirst({
        where: { apiFootballTeamId: afTeamId },
      });
      if (existing) return existing;
    }
    if (name) {
      const existing = await db.club.findFirst({
        where: { name: { equals: name } },
      });
      if (existing) return existing;
    }
    return null;
  }
}

export { parseAfTeamId };
