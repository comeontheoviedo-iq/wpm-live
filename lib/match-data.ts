import { rechunkOverlongLeagueNotes } from "./rechunk-league-notes";
import { prisma } from "./prisma";
import { displayText } from "./utils";


/** Decode stored HTML entities on the in-memory desk payload (never persisted). */
function presentMatchFull(m: object): void {
  const rec = m as {
    homeClub?: { name: string; shortName: string; players?: { name: string }[]; coaches?: { name: string }[] };
    awayClub?: { name: string; shortName: string; players?: { name: string }[]; coaches?: { name: string }[] };
    venue?: { name: string; city: string } | null;
    matchDay?: { title: string; competition: string };
    notes?: { title: string; body: string }[];
    speaks?: { title: string; body: string }[];
    events?: { player?: { name: string } | null }[];
    injuries?: {
      player?: { name: string } | null;
      club?: { name: string; shortName: string } | null;
    }[];
    officials?: { official?: { name: string } | null }[];
  };
  const cleanClub = (c?: { name: string; shortName: string; players?: { name: string }[]; coaches?: { name: string }[] }) => {
    if (!c) return;
    c.name = displayText(c.name);
    c.shortName = displayText(c.shortName);
    c.players?.forEach((p) => {
      p.name = displayText(p.name);
    });
    c.coaches?.forEach((co) => {
      co.name = displayText(co.name);
    });
  };
  cleanClub(rec.homeClub);
  cleanClub(rec.awayClub);
  if (rec.venue) {
    rec.venue.name = displayText(rec.venue.name);
    rec.venue.city = displayText(rec.venue.city);
  }
  if (rec.matchDay) {
    rec.matchDay.title = displayText(rec.matchDay.title);
    rec.matchDay.competition = displayText(rec.matchDay.competition);
  }
  rec.notes?.forEach((n) => {
    n.title = displayText(n.title);
    n.body = displayText(n.body);
  });
  rec.speaks?.forEach((s) => {
    s.title = displayText(s.title);
    s.body = displayText(s.body);
  });
  rec.events?.forEach((e) => {
    if (e.player) e.player.name = displayText(e.player.name);
  });
  rec.injuries?.forEach((i) => {
    if (i.player) i.player.name = displayText(i.player.name);
    if (i.club) {
      i.club.name = displayText(i.club.name);
      i.club.shortName = displayText(i.club.shortName);
    }
  });
  rec.officials?.forEach((o) => {
    if (o.official) o.official.name = displayText(o.official.name);
  });
}

const matchFullInclude = {
  homeClub: {
    include: {
      players: { orderBy: { shirtNumber: "asc" as const } },
      coaches: true,
    },
  },
  awayClub: {
    include: {
      players: { orderBy: { shirtNumber: "asc" as const } },
      coaches: true,
    },
  },
  venue: true,
  matchDay: true,
  notes: { orderBy: { createdAt: "desc" as const } },
  speaks: { orderBy: { order: "asc" as const } },
  checklistItems: { orderBy: { order: "asc" as const } },
  events: {
    orderBy: [{ minute: "desc" as const }, { createdAt: "desc" as const }],
    include: { player: true },
  },
  officials: { include: { official: true } },
  injuries: { include: { player: true, club: true } },
  statistics: { orderBy: { order: "asc" as const } },
  playerOverrides: true,
} as const;

export async function getFeaturedMatchId() {
  const m = await prisma.match.findFirst({
    where: { featured: true },
    orderBy: { kickoff: "asc" },
  });
  return m?.id;
}

/**
 * Resolve a match desk URL id. Desk/nav sometimes pass MatchDay id;
 * prefer Match id, then fall back to the first/only match for that MatchDay.
 */
export async function getMatchFull(id: string) {
  const byMatch = await prisma.match.findUnique({
    where: { id },
    include: matchFullInclude,
  });
  if (byMatch) {
    try {
      const result = await rechunkOverlongLeagueNotes(byMatch.id);
      if (result.split > 0 || result.created > 0) {
        const refreshed = await prisma.match.findUnique({
          where: { id: byMatch.id },
          include: matchFullInclude,
        });
        if (refreshed) {
          presentMatchFull(refreshed);
          return refreshed;
        }
      }
    } catch {
      /* soft-fail */
    }
    presentMatchFull(byMatch);
    return byMatch;
  }

  const byDay = await prisma.match.findFirst({
    where: { matchDayId: id },
    orderBy: { kickoff: "asc" },
    include: matchFullInclude,
  });
  if (!byDay) return byDay;
  try {
    const result = await rechunkOverlongLeagueNotes(byDay.id);
    if (result.split > 0 || result.created > 0) {
      const refreshed = await prisma.match.findUnique({
        where: { id: byDay.id },
        include: matchFullInclude,
      });
      if (refreshed) {
        presentMatchFull(refreshed);
        return refreshed;
      }
    }
  } catch {
    /* soft-fail */
  }
  presentMatchFull(byDay);
  return byDay;
}
