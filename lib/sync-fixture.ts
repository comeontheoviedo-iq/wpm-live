import { prisma } from "./prisma";
import { slotsFor } from "./formations";
import {
  assignSlotsFromStartXI,
  getEvents,
  getFixture,
  getInjuriesByFixture,
  getLastPlayedLineup,
  getLineups,
  getPredictions,
  getSquads,
  mapAfStatus,
  parsePercent,
  summarizeH2h,
  type AfEvent,
  type AfLineup,
  type AfSquadPlayer,
} from "./api-football";

function posGuess(pos?: string | null) {
  if (!pos) return "MID";
  const p = pos.toUpperCase();
  if (p.startsWith("G")) return "GK";
  if (p.startsWith("D")) return "DEF";
  if (p.startsWith("M")) return "MID";
  if (p.startsWith("F") || p.startsWith("A")) return "FWD";
  return p;
}

async function findClubPlayer(
  clubId: string,
  opts: { apiId?: number | null; name?: string | null; number?: number | null }
) {
  if (opts.apiId) {
    const byApi = await prisma.player.findFirst({
      where: { clubId, apiFootballPlayerId: opts.apiId },
    });
    if (byApi) return byApi;
  }
  if (opts.name) {
    const byName = await prisma.player.findFirst({
      where: {
        clubId,
        name: opts.name,
        ...(opts.number != null ? { shirtNumber: opts.number } : {}),
      },
    });
    if (byName) return byName;
    if (opts.number == null) {
      return prisma.player.findFirst({ where: { clubId, name: opts.name } });
    }
  }
  return null;
}

export async function syncSquadForClub(clubId: string, teamAfId: number) {
  const rows = await getSquads(teamAfId);
  const squad = rows[0];
  if (!squad?.players?.length) return { upserted: 0 };

  let upserted = 0;
  for (const p of squad.players as AfSquadPlayer[]) {
    const existing = await findClubPlayer(clubId, {
      apiId: p.id,
      name: p.name,
      number: p.number ?? null,
    });
    const data = {
      name: p.name,
      shirtNumber: p.number ?? existing?.shirtNumber ?? 0,
      position: posGuess(p.position),
      age: p.age ?? existing?.age ?? null,
      apiFootballPlayerId: p.id,
    };
    if (existing) {
      await prisma.player.update({ where: { id: existing.id }, data });
    } else {
      await prisma.player.create({
        data: {
          clubId,
          ...data,
          isStarter: false,
          onPitch: false,
        },
      });
    }
    upserted++;
  }
  return { upserted };
}

async function upsertLineupSide(
  clubId: string,
  lineup: AfLineup,
  side: "home" | "away"
) {
  const formation = lineup.formation || (side === "home" ? "4-3-3" : "4-2-3-1");

  await prisma.player.updateMany({
    where: { clubId },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });

  const slotIds = assignSlotsFromStartXI(lineup.startXI || [], formation);
  for (let i = 0; i < lineup.startXI.length; i++) {
    const row = lineup.startXI[i];
    const p = row.player;
    const slot = slotIds[i] || slotsFor(formation)[i]?.id || `S${i + 1}`;
    const existing = await findClubPlayer(clubId, {
      apiId: p.id,
      name: p.name,
      number: p.number,
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
    const existing = await findClubPlayer(clubId, {
      apiId: p.id,
      name: p.name,
      number: p.number,
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          isStarter: false,
          onPitch: false,
          formationSlot: null,
          apiFootballPlayerId: p.id || existing.apiFootballPlayerId,
          shirtNumber: p.number || existing.shirtNumber,
          position: posGuess(p.pos) || existing.position,
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

/** Re-apply a saved personal predicted XI onto Player rows. */
export async function applyPredictedJson(
  clubId: string,
  json: string | null | undefined
) {
  if (!json) return false;
  let slots: { playerId: string; formationSlot: string }[] = [];
  try {
    slots = JSON.parse(json);
  } catch {
    return false;
  }
  if (!Array.isArray(slots) || !slots.length) return false;

  await prisma.player.updateMany({
    where: { clubId },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });
  for (const s of slots) {
    if (!s.playerId || !s.formationSlot) continue;
    await prisma.player.updateMany({
      where: { id: s.playerId, clubId },
      data: {
        isStarter: true,
        onPitch: true,
        formationSlot: s.formationSlot,
      },
    });
  }
  return true;
}

export async function snapshotPredictedSide(clubId: string) {
  const starters = await prisma.player.findMany({
    where: { clubId, OR: [{ isStarter: true }, { onPitch: true }] },
    select: { id: true, formationSlot: true },
  });
  return JSON.stringify(
    starters
      .filter((p) => p.formationSlot)
      .map((p) => ({ playerId: p.id, formationSlot: p.formationSlot }))
  );
}

async function syncInjuriesForMatch(
  matchId: string,
  fixtureId: number,
  homeClubId: string,
  awayClubId: string,
  homeAfId: number,
  awayAfId: number
) {
  const injuries = await getInjuriesByFixture(fixtureId);
  await prisma.injury.deleteMany({ where: { matchId } });

  let count = 0;
  for (const inj of injuries) {
    const teamId = inj.team?.id;
    const clubId =
      teamId === homeAfId ? homeClubId : teamId === awayAfId ? awayClubId : null;
    if (!clubId) continue;

    let player = await findClubPlayer(clubId, {
      apiId: inj.player?.id,
      name: inj.player?.name,
    });
    if (!player && inj.player?.name) {
      player = await prisma.player.create({
        data: {
          clubId,
          name: inj.player.name,
          shirtNumber: 0,
          position: "MID",
          apiFootballPlayerId: inj.player.id || null,
        },
      });
    }
    if (!player) continue;

    const reason = inj.player?.reason || inj.player?.type || "Injury";
    const status = /doubt/i.test(reason)
      ? "doubtful"
      : /suspend/i.test(reason)
        ? "suspended"
        : "out";

    await prisma.injury.create({
      data: {
        matchId,
        clubId,
        playerId: player.id,
        status,
        injuryType: reason,
        notes: inj.player?.type || null,
      },
    });
    count++;
  }
  return count;
}

async function syncPredictionsForMatch(
  matchId: string,
  fixtureId: number,
  homeAfId: number,
  awayAfId: number
) {
  const list = await getPredictions(fixtureId);
  const pred = list[0];
  if (!pred) {
    return { advice: null as string | null, h2h: null as string | null };
  }
  const percent = pred.predictions?.percent || {};
  const payload = {
    advice: pred.predictions?.advice || null,
    winner: pred.predictions?.winner || null,
    percent: {
      home: parsePercent(percent.home),
      draw: parsePercent(percent.draw),
      away: parsePercent(percent.away),
      raw: percent,
    },
    comparison: pred.comparison || null,
  };
  const h2h = summarizeH2h(pred.h2h, homeAfId, awayAfId);
  await prisma.match.update({
    where: { id: matchId },
    data: {
      predictionsAdvice: payload.advice,
      predictionsJson: JSON.stringify(payload),
      h2hSummary: h2h,
    },
  });
  return { advice: payload.advice, h2h };
}

async function applySubEvent(
  _matchId: string,
  homeClubId: string,
  awayClubId: string,
  homeTeamAfId: number | null,
  awayTeamAfId: number | null,
  ev: AfEvent,
  homeFormation?: string | null,
  awayFormation?: string | null
) {
  const teamAfId = ev.team?.id;
  const isHome = Boolean(teamAfId && homeTeamAfId && teamAfId === homeTeamAfId);
  const clubId =
    isHome
      ? homeClubId
      : teamAfId && awayTeamAfId && teamAfId === awayTeamAfId
        ? awayClubId
        : null;
  if (!clubId) return;

  const formation = (isHome ? homeFormation : awayFormation) || "4-3-3";
  const validSlots = slotsFor(formation);

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
      let slot = inheritedSlot || inP.formationSlot;
      if (!slot || !validSlots.some((s) => s.id === slot)) {
        const used = new Set(
          (
            await prisma.player.findMany({
              where: { clubId, OR: [{ isStarter: true }, { onPitch: true }] },
              select: { formationSlot: true },
            })
          )
            .map((p) => p.formationSlot)
            .filter(Boolean) as string[]
        );
        slot =
          validSlots.find((s) => !used.has(s.id))?.id ||
          validSlots[validSlots.length - 1]?.id ||
          null;
      }
      await prisma.player.update({
        where: { id: inP.id },
        data: {
          onPitch: true,
          isStarter: true,
          formationSlot: slot,
        },
      });
    }
  }
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

/**
 * Full desk sync:
 * - squads for both clubs
 * - injuries
 * - predictions + H2H
 * - official lineups when present → lineupStatus=confirmed
 * - else Expected (last XI) unless user already has a personal predicted board
 * - events when live/available
 */

/** Ensure at most one on-pitch player per formation slot (subs can double-book on name mismatch). */
async function dedupeClubSlots(clubId: string, formation?: string | null) {
  const valid = new Set(slotsFor(formation || "4-3-3").map((s) => s.id));
  const onPitch = await prisma.player.findMany({
    where: { clubId, OR: [{ isStarter: true }, { onPitch: true }] },
  });
  const bySlot = new Map<string, typeof onPitch>();
  for (const p of onPitch) {
    const slot = p.formationSlot;
    if (!slot || !valid.has(slot)) {
      // Invalid slot → clear from XI
      await prisma.player.update({
        where: { id: p.id },
        data: { isStarter: false, onPitch: false, formationSlot: null },
      });
      continue;
    }
    const list = bySlot.get(slot) || [];
    list.push(p);
    bySlot.set(slot, list);
  }
  for (const [, list] of bySlot) {
    if (list.length <= 1) continue;
    // Prefer FWD/MID who are not the "original" alphabetical first — keep highest shirt as heuristic for late sub,
    // else keep the last in list.
    const keep = [...list].sort((a, b) => (b.shirtNumber || 0) - (a.shirtNumber || 0))[0];
    for (const p of list) {
      if (p.id === keep.id) continue;
      await prisma.player.update({
        where: { id: p.id },
        data: { isStarter: false, onPitch: false, formationSlot: null },
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

  const homeAfId = fixture.teams.home.id;
  const awayAfId = fixture.teams.away.id;

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

  const squadHome = await syncSquadForClub(match.homeClubId, homeAfId).catch(
    () => ({ upserted: 0 })
  );
  const squadAway = await syncSquadForClub(match.awayClubId, awayAfId).catch(
    () => ({ upserted: 0 })
  );

  const injuryCount = await syncInjuriesForMatch(
    matchId,
    match.apiFootballFixtureId,
    match.homeClubId,
    match.awayClubId,
    homeAfId,
    awayAfId
  ).catch(() => 0);

  const pred = await syncPredictionsForMatch(
    matchId,
    match.apiFootballFixtureId,
    homeAfId,
    awayAfId
  ).catch(() => ({ advice: null, h2h: null }));

  const lineups = await getLineups(match.apiFootballFixtureId);
  let homeFormation = match.homeFormation;
  let awayFormation = match.awayFormation;
  let lineupStatus = match.lineupStatus || "expected";
  let expectedFrom: number | null = null;

  if (lineups.length >= 1 && lineups.some((l) => l.startXI?.length)) {
    lineupStatus = "confirmed";
    for (const lu of lineups) {
      if (lu.team.id === homeAfId) {
        homeFormation = await upsertLineupSide(match.homeClubId, lu, "home");
      } else if (lu.team.id === awayAfId) {
        awayFormation = await upsertLineupSide(match.awayClubId, lu, "away");
      }
    }
  } else if (match.lineupStatus === "predicted") {
    // Preserve personal DnD board; refresh from saved JSON if needed
    await applyPredictedJson(match.homeClubId, match.predictedHomeJson);
    await applyPredictedJson(match.awayClubId, match.predictedAwayJson);
    lineupStatus = "predicted";
  } else {
    // Expected XI = last finished lineup for each team
    const homeLast = await getLastPlayedLineup(homeAfId).catch(() => null);
    const awayLast = await getLastPlayedLineup(awayAfId).catch(() => null);
    if (homeLast) {
      homeFormation = await upsertLineupSide(
        match.homeClubId,
        homeLast.lineup,
        "home"
      );
      expectedFrom = homeLast.fixtureId;
    }
    if (awayLast) {
      awayFormation = await upsertLineupSide(
        match.awayClubId,
        awayLast.lineup,
        "away"
      );
      expectedFrom = expectedFrom || awayLast.fixtureId;
    }
    lineupStatus = homeLast || awayLast ? "expected" : match.lineupStatus || "expected";
  }

  const events = await getEvents(match.apiFootballFixtureId).catch(() => []);
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

    if (type === "sub" && lineupStatus === "confirmed") {
      await applySubEvent(
        matchId,
        match.homeClubId,
        match.awayClubId,
        homeAfId,
        awayAfId,
        ev,
        homeFormation,
        awayFormation
      );
    }
  }

  if (lineupStatus === "confirmed") {
    await dedupeClubSlots(match.homeClubId, homeFormation);
    await dedupeClubSlots(match.awayClubId, awayFormation);
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
    squadHome: squadHome.upserted,
    squadAway: squadAway.upserted,
    injuryCount,
    predictionsAdvice: pred.advice,
    h2hSummary: pred.h2h,
    expectedFrom,
  };
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

/** Persist a personal predicted XI from desk DnD. */
export async function savePredictedLineup(
  matchId: string,
  side: "home" | "away",
  slots: { playerId: string; formationSlot: string }[],
  formation?: string
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("Match not found");
  // Commentary desk may remap even when Official is showing; Sync resets from AF.
  // Bulk predicted save no longer hard-blocks confirmed boards.

  const clubId = side === "home" ? match.homeClubId : match.awayClubId;
  await prisma.player.updateMany({
    where: { clubId },
    data: { isStarter: false, onPitch: false, formationSlot: null },
  });

  for (const s of slots) {
    await prisma.player.updateMany({
      where: { id: s.playerId, clubId },
      data: {
        isStarter: true,
        onPitch: true,
        formationSlot: s.formationSlot,
      },
    });
  }

  const json = JSON.stringify(slots);
  const data: Record<string, unknown> = {
    lineupStatus: "predicted",
    ...(side === "home"
      ? { predictedHomeJson: json }
      : { predictedAwayJson: json }),
  };
  if (formation) {
    if (side === "home") data.homeFormation = formation;
    else data.awayFormation = formation;
  }

  return prisma.match.update({ where: { id: matchId }, data });
}
