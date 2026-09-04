import { prisma } from "./prisma";
import {
  getEvents,
  getFixture,
  getLineups,
  gridToSlot,
  mapAfStatus,
  type AfEvent,
  type AfLineup,
} from "./api-football";

function posGuess(pos?: string) {
  if (!pos) return "MID";
  const p = pos.toUpperCase();
  if (p.startsWith("G")) return "GK";
  if (p.startsWith("D")) return "DEF";
  if (p.startsWith("M")) return "MID";
  if (p.startsWith("F") || p.startsWith("A")) return "FWD";
  return p;
}

async function upsertLineupSide(
  clubId: string,
  lineup: AfLineup,
  side: "home" | "away"
) {
  const formation = lineup.formation || (side === "home" ? "4-3-3" : "4-2-3-1");

  // Reset starters for this club
  await prisma.player.updateMany({
    where: { clubId },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });

  for (let i = 0; i < lineup.startXI.length; i++) {
    const row = lineup.startXI[i];
    const p = row.player;
    const slot = gridToSlot(p.grid, i);
    const existing = await prisma.player.findFirst({
      where: {
        clubId,
        OR: [
          ...(p.id ? [{ apiFootballPlayerId: p.id }] : []),
          { AND: [{ name: p.name }, { shirtNumber: p.number || 0 }] },
        ],
      },
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          shirtNumber: p.number || existing.shirtNumber,
          position: posGuess(p.pos),
          isStarter: true,
          onPitch: true,
          formationSlot: slot,
          apiFootballPlayerId: p.id || existing.apiFootballPlayerId,
        },
      });
    } else {
      await prisma.player.create({
        data: {
          clubId,
          name: p.name,
          shirtNumber: p.number || i + 1,
          position: posGuess(p.pos),
          isStarter: true,
          onPitch: true,
          formationSlot: slot,
          apiFootballPlayerId: p.id || null,
        },
      });
    }
  }

  for (const row of lineup.substitutes || []) {
    const p = row.player;
    const existing = await prisma.player.findFirst({
      where: {
        clubId,
        OR: [
          ...(p.id ? [{ apiFootballPlayerId: p.id }] : []),
          { AND: [{ name: p.name }, { shirtNumber: p.number || 0 }] },
        ],
      },
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          isStarter: false,
          onPitch: false,
          formationSlot: null,
          apiFootballPlayerId: p.id || existing.apiFootballPlayerId,
        },
      });
    } else {
      await prisma.player.create({
        data: {
          clubId,
          name: p.name,
          shirtNumber: p.number || 99,
          position: posGuess(p.pos),
          isStarter: false,
          onPitch: false,
          apiFootballPlayerId: p.id || null,
        },
      });
    }
  }

  if (lineup.coach?.name) {
    const coach = await prisma.coach.findFirst({ where: { clubId } });
    if (coach) {
      await prisma.coach.update({
        where: { id: coach.id },
        data: { name: lineup.coach.name },
      });
    } else {
      await prisma.coach.create({
        data: { clubId, name: lineup.coach.name, role: "Head Coach" },
      });
    }
  }

  return formation;
}

async function applySubEvent(
  _matchId: string,
  homeClubId: string,
  awayClubId: string,
  homeTeamAfId: number | null,
  awayTeamAfId: number | null,
  ev: AfEvent
) {
  // API-Football subst: player = leaving, assist = entering
  const teamAfId = ev.team?.id;
  const clubId =
    teamAfId && homeTeamAfId && teamAfId === homeTeamAfId
      ? homeClubId
      : teamAfId && awayTeamAfId && teamAfId === awayTeamAfId
        ? awayClubId
        : null;
  if (!clubId) return;

  const outName = ev.player?.name;
  const inName = ev.assist?.name;

  let inheritedSlot: string | null = null;
  if (outName) {
    const outP = await prisma.player.findFirst({
      where: { clubId, name: outName },
    });
    if (outP) {
      inheritedSlot = outP.formationSlot;
      await prisma.player.update({
        where: { id: outP.id },
        data: { onPitch: false, isStarter: false, formationSlot: null },
      });
    }
  }
  if (inName) {
    const inP = await prisma.player.findFirst({
      where: { clubId, name: inName },
    });
    if (inP) {
      await prisma.player.update({
        where: { id: inP.id },
        data: {
          onPitch: true,
          isStarter: true,
          formationSlot: inheritedSlot || inP.formationSlot || "CM",
        },
      });
    }
  }
}

export async function syncMatchFromApiFootball(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeClub: true, awayClub: true },
  });
  if (!match) throw new Error("Match not found");
  if (!match.apiFootballFixtureId) {
    throw new Error("Match has no apiFootballFixtureId linked");
  }

  const fixture = await getFixture(match.apiFootballFixtureId);
  if (!fixture) throw new Error("Fixture not found on API-Football");

  const lineups = await getLineups(match.apiFootballFixtureId);
  let homeFormation = match.homeFormation;
  let awayFormation = match.awayFormation;
  let lineupStatus = match.lineupStatus;

  const homeAfId = fixture.teams.home.id;
  const awayAfId = fixture.teams.away.id;

  // Persist team ids
  if (!match.homeClub.apiFootballTeamId) {
    await prisma.club.update({
      where: { id: match.homeClubId },
      data: { apiFootballTeamId: homeAfId },
    });
  }
  if (!match.awayClub.apiFootballTeamId) {
    await prisma.club.update({
      where: { id: match.awayClubId },
      data: { apiFootballTeamId: awayAfId },
    });
  }

  if (lineups.length) {
    lineupStatus = "confirmed";
    for (const lu of lineups) {
      if (lu.team.id === homeAfId) {
        homeFormation = await upsertLineupSide(match.homeClubId, lu, "home");
      } else if (lu.team.id === awayAfId) {
        awayFormation = await upsertLineupSide(match.awayClubId, lu, "away");
      }
    }
  } else {
    lineupStatus = match.lineupStatus || "predicted";
  }

  const events = await getEvents(match.apiFootballFixtureId);
  const homeScore = fixture.goals.home ?? match.homeScore;
  const awayScore = fixture.goals.away ?? match.awayScore;
  const minute = fixture.fixture.status.elapsed ?? match.minute;
  const status = mapAfStatus(fixture.fixture.status.short);

  for (const ev of events) {
    const elapsed = ev.time?.elapsed ?? 0;
    const desc = `${ev.detail}${ev.player?.name ? ` — ${ev.player.name}` : ""}${
      ev.assist?.name ? ` (${ev.assist.name})` : ""
    }`;
    const type = mapEventType(ev);
    const teamSide =
      ev.team?.id === homeAfId ? "home" : ev.team?.id === awayAfId ? "away" : null;

    const existing = await prisma.matchEvent.findFirst({
      where: {
        matchId,
        minute: elapsed,
        type,
        description: desc,
      },
    });
    if (!existing) {
      await prisma.matchEvent.create({
        data: {
          matchId,
          type,
          minute: elapsed,
          teamSide,
          description: desc,
        },
      });
    }

    if (type === "sub") {
      await applySubEvent(
        matchId,
        match.homeClubId,
        match.awayClubId,
        homeAfId,
        awayAfId,
        ev
      );
    }
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      minute,
      status: status === "Assigned" ? match.status : status,
      homeFormation,
      awayFormation,
      lineupStatus,
      lastFeedSyncAt: new Date(),
      period:
        fixture.fixture.status.short === "HT"
          ? "HT"
          : fixture.fixture.status.short === "FT"
            ? "FT"
            : match.period,
    },
  });

  return {
    match: updated,
    lineupCount: lineups.length,
    eventCount: events.length,
    lineupStatus,
  };
}

function mapEventType(ev: AfEvent): string {
  const t = (ev.type || "").toLowerCase();
  const d = (ev.detail || "").toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return "own_goal";
    if (d.includes("penalty")) return "penalty_goal";
    return "goal";
  }
  if (t === "card") {
    if (d.includes("red")) return "red";
    return "yellow";
  }
  if (t === "subst") return "sub";
  if (t === "var") return "var";
  return t || "note";
}

export async function linkFixtureToMatch(
  matchId: string,
  apiFootballFixtureId: number
) {
  return prisma.match.update({
    where: { id: matchId },
    data: { apiFootballFixtureId },
  });
}
