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
  getStatistics,
  getTopScorers,
  getPlayersByTeam,
  getPlayerById,
  getVenueById,
  getTeam,
  getCoachById,
  getCoachByTeam,
  mapAfStatus,
  parsePercent,
  summarizeH2h,
  type AfEvent,
  type AfLineup,
  type AfSquadPlayer,
} from "./api-football";
import { resolveWeatherForVenue } from "./weather";
import { nationalityToIso } from "./flags";


/**
 * From AF /players statistics, pick a national-team country when the player
 * has appearances for a country side in international competitions.
 * AF often keeps citizenship as England while birth/NT is African (e.g. Maswanhise → Zimbabwe).
 */
function pickNationalTeamCountry(
  statistics?: {
    team?: { id?: number; name?: string } | null;
    league?: { name?: string; country?: string | null } | null;
    games?: { appearences?: number | null } | null;
  }[]
): string | null {
  if (!statistics?.length) return null;
  let best: { country: string; apps: number } | null = null;
  for (const s of statistics) {
    const teamName = s.team?.name?.trim();
    if (!teamName) continue;
    if (
      /\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough)\b/i.test(
        teamName
      )
    ) {
      continue;
    }
    if (!nationalityToIso(teamName)) continue;
    const league = s.league?.name || "";
    const intl =
      /world cup|friendlies|nations|africa cup|afcon|\beuro\b|copa|asian cup|gold cup|olympics|qualification|confederations|uefa nations|african nations/i.test(
        league
      );
    if (!intl) continue;
    const apps = s.games?.appearences ?? 0;
    if (apps <= 0) continue;
    if (!best || apps > best.apps) best = { country: teamName, apps };
  }
  return best?.country || null;
}

function sameCountryLabel(a?: string | null, b?: string | null) {
  const ia = nationalityToIso(a);
  const ib = nationalityToIso(b);
  if (ia && ib) return ia === ib;
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

function posGuess(pos?: string | null) {
  if (!pos) return "MID";
  const p = pos.toUpperCase();
  if (p.startsWith("G")) return "GK";
  if (p.startsWith("D")) return "DEF";
  if (p.startsWith("M")) return "MID";
  if (p.startsWith("F") || p.startsWith("A")) return "FWD";
  return p;
}


/** Placeholder / seed defaults that must be overwritten from API-Football. */
function isUnsetNationality(n?: string | null) {
  if (!n) return true;
  const v = n.trim().toUpperCase();
  return !v || v === "ENG" || v === "UNK" || v === "UNKNOWN";
}

function parseCm(h?: string | null) {
  if (!h) return null;
  const m = String(h).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function parseKg(w?: string | null) {
  if (!w) return null;
  const m = String(w).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Prefer AF nationality (citizenship). When AF lists a national team with apps,
 * prefer that over a stale England/club-country citizenship.
 * Store birth.country separately for SportsCom-style dual flags.
 */
async function upsertPlayerBioFromAf(
  clubId: string,
  row: {
    apiId: number;
    name: string;
    nationality?: string;
    birthCountry?: string | null;
    nationalTeam?: string | null;
    photo?: string;
    height?: string;
    weight?: string;
    birth?: string | null;
    age?: number | null;
    position?: string | null;
    rating?: number | null;
    goals?: number;
    assists?: number;
    apps?: number;
  }
) {
  const existing = await findClubPlayer(clubId, {
    apiId: row.apiId,
    name: row.name,
  });
  const afNat = row.nationality?.trim() || null;
  const nt = row.nationalTeam?.trim() || null;
  // Citizenship: national team with caps wins when it differs from AF nationality
  let nat = afNat;
  if (nt && (!afNat || !sameCountryLabel(afNat, nt))) {
    nat = nt;
  }
  const birthCountry = row.birthCountry?.trim() || null;

  if (!existing) {
    await prisma.player.create({
      data: {
        clubId,
        name: row.name,
        shirtNumber: 0,
        position: posGuess(row.position),
        apiFootballPlayerId: row.apiId,
        age: row.age ?? null,
        nationality: nat || "UNK",
        birthCountry: birthCountry,
        photoUrl: row.photo || null,
        heightCm: parseCm(row.height),
        weightKg: parseKg(row.weight),
        birthDate: row.birth || null,
        goals: row.goals || 0,
        assists: row.assists || 0,
        appearances: row.apps || 0,
        ...(row.rating != null ? { rating: row.rating } : {}),
      },
    });
    return;
  }
  const data: Record<string, unknown> = {};
  if (nat && (isUnsetNationality(existing.nationality) || existing.nationality !== nat)) {
    data.nationality = nat;
  }
  if (birthCountry && existing.birthCountry !== birthCountry) {
    data.birthCountry = birthCountry;
  }
  if (row.photo && !existing.photoUrl) data.photoUrl = row.photo;
  const h = parseCm(row.height);
  if (h && !existing.heightCm) data.heightCm = h;
  const w = parseKg(row.weight);
  if (w && !existing.weightKg) data.weightKg = w;
  if (row.birth && !existing.birthDate) data.birthDate = row.birth;
  if (row.age && !existing.age) data.age = row.age;
  if (row.rating != null) data.rating = row.rating;
  if (row.apps) data.appearances = row.apps;
  if (row.goals != null && row.goals > (existing.goals || 0)) data.goals = row.goals;
  if (row.assists != null && row.assists > (existing.assists || 0)) data.assists = row.assists;
  if (Object.keys(data).length) {
    await prisma.player.update({ where: { id: existing.id }, data });
  }
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
      ...(p.photo ? { photoUrl: p.photo } : {}),
    };
    if (existing) {
      await prisma.player.update({ where: { id: existing.id }, data });
    } else {
      await prisma.player.create({
        data: {
          clubId,
          ...data,
          // Squads endpoint has no nationality — leave UNK until /players enrich
          nationality: "UNK",
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
          nationality: "UNK",
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
          nationality: "UNK",
          isStarter: false,
          onPitch: false,
          apiFootballPlayerId: p.id || null,
        },
      });
    }
  }

  if (lineup.coach?.name) {
    await upsertCoachFromLineup(clubId, lineup);
  }

  return formation;
}

/**
 * Sync coach name + nationality/age from AF.
 * Lineup.coach only has id/name/photo — fetch /coachs for nationality & age.
 * Never default to ENG; use UNK when AF has no nationality.
 */
async function upsertCoachFromLineup(clubId: string, lineup: AfLineup) {
  const name = lineup.coach?.name?.trim();
  if (!name) return;

  let nationality = "UNK";
  let age: number | null = null;

  const coachAfId = lineup.coach?.id;
  let detail = coachAfId
    ? await getCoachById(coachAfId).catch(() => null)
    : null;
  if (!detail && lineup.team?.id) {
    detail = await getCoachByTeam(lineup.team.id).catch(() => null);
  }
  if (detail) {
    const nat = detail.nationality?.trim();
    if (nat) nationality = nat;
    if (detail.age != null && Number.isFinite(detail.age)) age = detail.age;
  }

  const coach = await prisma.coach.findFirst({ where: { clubId } });
  const data = {
    name: detail?.name?.trim() || name,
    nationality,
    ...(age != null ? { age } : {}),
    role: "Head Coach" as const,
  };
  if (coach) {
    const patch: Record<string, unknown> = { name: data.name };
    // Always set nationality when we have AF detail, or when still on ENG/UNK placeholder
    if (detail?.nationality?.trim()) {
      patch.nationality = nationality;
    } else if (isUnsetNationality(coach.nationality)) {
      patch.nationality = "UNK";
    }
    if (age != null) patch.age = age;
    await prisma.coach.update({ where: { id: coach.id }, data: patch });
  } else {
    await prisma.coach.create({
      data: { clubId, ...data },
    });
  }
}

/** Patch a club coach from /coachs?team= when no lineup coach id is available. */
export async function syncCoachForClub(clubId: string, teamAfId: number) {
  const detail = await getCoachByTeam(teamAfId).catch(() => null);
  if (!detail?.name) {
    // Ensure ENG placeholders become UNK even without AF data
    await prisma.coach.updateMany({
      where: { clubId, nationality: { in: ["ENG", "UNKNOWN", ""] } },
      data: { nationality: "UNK" },
    });
    return null;
  }
  const nationality = detail.nationality?.trim() || "UNK";
  const age =
    detail.age != null && Number.isFinite(detail.age) ? detail.age : null;
  const existing = await prisma.coach.findFirst({ where: { clubId } });
  if (existing) {
    await prisma.coach.update({
      where: { id: existing.id },
      data: {
        name: detail.name,
        nationality,
        ...(age != null ? { age } : {}),
      },
    });
    return existing.id;
  }
  const created = await prisma.coach.create({
    data: {
      clubId,
      name: detail.name,
      nationality,
      age,
      role: "Head Coach",
    },
  });
  return created.id;
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
    if (d.includes("missed") && d.includes("penalty")) return "penalty_miss";
    if (d.includes("penalty")) return "penalty_goal";
    return "goal";
  }
  if (t.includes("missed") || (t === "missed penalty")) {
    return "penalty_miss";
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


async function syncVenueAndWeather(
  matchId: string,
  fixture: Awaited<ReturnType<typeof getFixture>>,
  kickoff: Date
) {
  if (!fixture) return { venueName: null as string | null, weather: null as string | null };
  const v = fixture.fixture.venue;
  const venueName = v?.name || null;
  const city = v?.city || null;
  let capacity = 0;
  let lat: number | null = null;
  let lon: number | null = null;
  let address: string | null = null;
  let surface: string | null = null;
  let imageUrl: string | null = null;
  let afVenueId = v?.id ?? null;

  if (afVenueId) {
    const detail = await getVenueById(afVenueId).catch(() => null);
    if (detail) {
      capacity = detail.capacity ?? 0;
      address = detail.address || null;
      surface = detail.surface || null;
      imageUrl = detail.image || null;
      // AF venues endpoint typically has no lat/lon — geocode city
    }
  } else if (fixture.teams?.home?.id) {
    // Fixture venue id often null — fall back to home club venue
    const team = await getTeam(fixture.teams.home.id).catch(() => null);
    const tv = team?.venue;
    if (tv?.id) {
      afVenueId = tv.id;
      capacity = tv.capacity ?? 0;
      address = tv.address || null;
      surface = tv.surface || null;
      imageUrl = tv.image || null;
      if (!venueName && tv.name) {
        // keep fixture name when present; else use club venue name
      }
    }
  }

  let venueId: string | null = null;
  if (venueName && city) {
    let existing = afVenueId
      ? await prisma.venue.findFirst({ where: { apiFootballVenueId: afVenueId } })
      : null;
    if (!existing) {
      existing = await prisma.venue.findFirst({ where: { name: venueName, city } });
    }
    if (!existing && afVenueId) {
      // last resort: same city with empty AF id
      existing = await prisma.venue.findFirst({
        where: { city, apiFootballVenueId: null },
      });
    }
    if (existing) {
      venueId = existing.id;
      await prisma.venue.update({
        where: { id: existing.id },
        data: {
          name: venueName,
          city,
          capacity: capacity || existing.capacity,
          address: address ?? existing.address,
          surface: surface || existing.surface,
          imageUrl: imageUrl ?? existing.imageUrl,
          apiFootballVenueId: afVenueId ?? existing.apiFootballVenueId,
        },
      });
      lat = existing.lat;
      lon = existing.lon;
    } else {
      const created = await prisma.venue.create({
        data: {
          name: venueName,
          city,
          capacity: capacity || 0,
          address,
          surface: surface || "Grass",
          imageUrl,
          apiFootballVenueId: afVenueId,
        },
      });
      venueId = created.id;
    }
  }

  const weather = city
    ? await resolveWeatherForVenue({
        city,
        countryHint: fixture.league?.country,
        lat,
        lon,
        kickoff,
      }).catch(() => null)
    : null;

  if (weather && venueId) {
    await prisma.venue.update({
      where: { id: venueId },
      data: { lat: weather.lat, lon: weather.lon },
    });
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      ...(venueId ? { venueId } : {}),
      ...(weather
        ? {
            weatherSummary: weather.summary,
            weatherTempC: weather.tempC,
            weatherWindKph: weather.windKph,
            weatherHumidity: weather.humidity,
          }
        : {}),
    },
  });

  return {
    venueName: venueName,
    weather: weather?.summary ?? null,
  };
}


async function syncSeasonScorers(
  homeClubId: string,
  awayClubId: string,
  homeAfId: number,
  awayAfId: number,
  leagueId: number,
  season: number
) {
  const clubByAf = new Map<number, string>([
    [homeAfId, homeClubId],
    [awayAfId, awayClubId],
  ]);

  await prisma.seasonScorer.deleteMany({
    where: { clubId: { in: [homeClubId, awayClubId] } },
  });
  await prisma.seasonKeeper.deleteMany({
    where: { clubId: { in: [homeClubId, awayClubId] } },
  });

  const tops = await getTopScorers(leagueId, season).catch(() => []);
  const teamPages: Awaited<ReturnType<typeof getPlayersByTeam>> = [];
  for (const teamId of [homeAfId, awayAfId]) {
    for (let page = 1; page <= 4; page++) {
      const rows = await getPlayersByTeam(teamId, season, page).catch(() => []);
      if (!rows.length) break;
      teamPages.push(...rows);
      if (rows.length < 20) break;
    }
  }

  type Acc = {
    clubId: string;
    apiId: number;
    name: string;
    goals: number;
    assists: number;
    apps: number;
    cleanSheets: number;
    saves: number;
    conceded: number;
    position?: string | null;
    age?: number | null;
    nationality?: string;
    birthCountry?: string | null;
    nationalTeam?: string | null;
    photo?: string;
    height?: string;
    weight?: string;
    birth?: string | null;
    rating?: number | null;
  };
  const byApi = new Map<number, Acc>();

  function ingest(row: (typeof tops)[number]) {
    const teamId = row.statistics?.[0]?.team?.id;
    const clubId = teamId && clubByAf.has(teamId) ? clubByAf.get(teamId)! : null;
    if (!clubId || !row.player?.id) return;
    const goals = row.statistics?.[0]?.goals?.total ?? 0;
    const assists = row.statistics?.[0]?.goals?.assists ?? 0;
    const apps = row.statistics?.[0]?.games?.appearences ?? 0;
    const saves = row.statistics?.[0]?.goals?.saves ?? 0;
    const conceded = row.statistics?.[0]?.goals?.conceded ?? 0;
    const rawRating = row.statistics?.[0]?.games?.rating;
    const ratingNum =
      rawRating != null && rawRating !== ""
        ? Number(rawRating)
        : null;
    const prev = byApi.get(row.player.id);
    const nt = pickNationalTeamCountry(row.statistics) || prev?.nationalTeam || null;
    byApi.set(row.player.id, {
      clubId,
      apiId: row.player.id,
      name: row.player.name,
      goals: Math.max(goals || 0, prev?.goals || 0),
      assists: Math.max(assists || 0, prev?.assists || 0),
      apps: Math.max(apps || 0, prev?.apps || 0),
      cleanSheets: prev?.cleanSheets || 0,
      saves: Math.max(saves || 0, prev?.saves || 0),
      conceded: Math.max(conceded || 0, prev?.conceded || 0),
      position: row.statistics?.[0]?.games?.position || prev?.position,
      age: row.player.age ?? prev?.age,
      nationality: row.player.nationality || prev?.nationality,
      birthCountry:
        row.player.birth?.country || prev?.birthCountry || null,
      nationalTeam: nt,
      photo: row.player.photo || prev?.photo,
      height: row.player.height || prev?.height,
      weight: row.player.weight || prev?.weight,
      birth: row.player.birth?.date || prev?.birth || null,
      rating:
        ratingNum != null && Number.isFinite(ratingNum)
          ? ratingNum
          : prev?.rating ?? null,
    });
  }

  for (const row of tops) ingest(row);
  for (const row of teamPages) ingest(row);

  // Team /players pages omit national-team rows; fetch /players?id= when we still
  // need NT detection (England-listed dual nationals) or missing birth country.
  async function hydrateFromPlayerId(apiId: number, clubId: string, fallbackName: string) {
    // Current season profile. If no NT caps here, peek prior season —
    // AF often parks Africa Cup / friendlies on the previous europeanSeasonYear.
    const cur = await getPlayerById(apiId, season).catch(() => []);
    const prev = byApi.get(apiId);
    let nt =
      pickNationalTeamCountry(cur[0]?.statistics) || prev?.nationalTeam || null;
    let prevSeasonRow: (typeof cur)[0] | undefined;
    const afNat = cur[0]?.player?.nationality || prev?.nationality || null;
    if (
      !nt &&
      /^(england|eng|unk|unknown)?$/i.test((afNat || "").trim())
    ) {
      const prevSeason = await getPlayerById(apiId, season - 1).catch(() => []);
      prevSeasonRow = prevSeason[0];
      nt =
        pickNationalTeamCountry(prevSeasonRow?.statistics) ||
        prev?.nationalTeam ||
        null;
    }
    const row = cur[0] || prevSeasonRow;
    if (!row?.player) return false;
    await upsertPlayerBioFromAf(clubId, {
      apiId: row.player.id,
      name: row.player.name || fallbackName,
      nationality: row.player.nationality || prev?.nationality,
      birthCountry: row.player.birth?.country || prev?.birthCountry || null,
      nationalTeam: nt,
      photo: row.player.photo || prev?.photo,
      height: row.player.height || prev?.height,
      weight: row.player.weight || prev?.weight,
      birth: row.player.birth?.date || prev?.birth || null,
      age: row.player.age ?? prev?.age ?? null,
      position: row.statistics?.[0]?.games?.position || prev?.position,
      rating: prev?.rating ?? null,
      goals: prev?.goals || 0,
      assists: prev?.assists || 0,
      apps: prev?.apps || 0,
    });
    return true;
  }

  // Enrich EVERY squad player from team /players pages first.
  let bios = 0;
  for (const row of byApi.values()) {
    await upsertPlayerBioFromAf(row.clubId, row);
    bios++;
  }

  // Full profile for anyone still missing NT while listed as England (AF quirk),
  // or missing birthCountry / unset nationality.
  const needsFullProfile = await prisma.player.findMany({
    where: {
      clubId: { in: [homeClubId, awayClubId] },
      apiFootballPlayerId: { not: null },
      OR: [
        { nationality: { in: ["UNK", "ENG", "UNKNOWN", "", "England"] } },
        { birthCountry: null },
      ],
    },
    select: {
      id: true,
      clubId: true,
      apiFootballPlayerId: true,
      name: true,
      nationality: true,
      birthCountry: true,
    },
  });
  for (const p of needsFullProfile) {
    const apiId = p.apiFootballPlayerId;
    if (!apiId) continue;
    const fromPages = byApi.get(apiId);
    // Team pages never include other-nation NT rows — always hydrate England / unset.
    const needsNt =
      !fromPages?.nationalTeam &&
      /^(england|eng|unk|unknown)?$/i.test((p.nationality || "").trim());
    const needsBirth = !p.birthCountry && !fromPages?.birthCountry;
    const needsNat = isUnsetNationality(p.nationality) && !fromPages?.nationality;
    if (!needsNt && !needsBirth && !needsNat) {
      if (fromPages) {
        await upsertPlayerBioFromAf(p.clubId, fromPages);
        bios++;
      }
      continue;
    }
    if (await hydrateFromPlayerId(apiId, p.clubId, p.name)) bios++;
  }

  // Final pass: anyone still England/ENG with an AF id — ensure NT promotion
  // survives even if an earlier team-page upsert missed NT rows.
  const stillEngland = await prisma.player.findMany({
    where: {
      clubId: { in: [homeClubId, awayClubId] },
      apiFootballPlayerId: { not: null },
      nationality: { in: ["UNK", "ENG", "UNKNOWN", "", "England"] },
    },
    select: { clubId: true, apiFootballPlayerId: true, name: true },
  });
  for (const p of stillEngland) {
    if (!p.apiFootballPlayerId) continue;
    if (await hydrateFromPlayerId(p.apiFootballPlayerId, p.clubId, p.name)) bios++;
  }

  let scorers = 0;
  let keepers = 0;

  const scorerRows = [...byApi.values()]
    .filter((r) => (r.goals || 0) > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists);

  let rank = 1;
  for (const row of scorerRows) {
    let player = await findClubPlayer(row.clubId, {
      apiId: row.apiId,
      name: row.name,
    });
    if (!player) {
      player = await prisma.player.create({
        data: {
          clubId: row.clubId,
          name: row.name,
          shirtNumber: 0,
          position: posGuess(row.position),
          apiFootballPlayerId: row.apiId,
          age: row.age ?? null,
          nationality: (row.nationalTeam &&
            (!row.nationality || !sameCountryLabel(row.nationality, row.nationalTeam))
              ? row.nationalTeam
              : row.nationality) || "UNK",
          birthCountry: row.birthCountry || null,
          photoUrl: row.photo || null,
          heightCm: parseCm(row.height),
          weightKg: parseKg(row.weight),
          birthDate: row.birth || null,
          goals: row.goals,
          assists: row.assists,
          appearances: row.apps || 0,
          ...(row.rating != null ? { rating: row.rating } : {}),
        },
      });
    } else {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          goals: row.goals,
          assists: row.assists,
          ...(row.apps ? { appearances: row.apps } : {}),
          ...(row.photo && !player.photoUrl ? { photoUrl: row.photo } : {}),
          ...(parseCm(row.height) && !player.heightCm
            ? { heightCm: parseCm(row.height) }
            : {}),
          ...(parseKg(row.weight) && !player.weightKg
            ? { weightKg: parseKg(row.weight) }
            : {}),
          ...(row.birth && !player.birthDate ? { birthDate: row.birth } : {}),
          // Do not overwrite nationality here — scorer rows omit NT and would
          // clobber Zimbabwe/etc. promoted during bio hydrate.
          ...(row.birthCountry && !player.birthCountry
            ? { birthCountry: row.birthCountry }
            : {}),
          ...(row.age && !player.age ? { age: row.age } : {}),
          ...(row.rating != null ? { rating: row.rating } : {}),
        },
      });
    }
    await prisma.seasonScorer.create({
      data: {
        clubId: row.clubId,
        playerId: player.id,
        goals: row.goals,
        assists: row.assists || 0,
        rank: rank++,
      },
    });
    scorers++;
  }

  const keeperAcc: Acc[] = [];
  for (const row of byApi.values()) {
    const pos = (row.position || "").toUpperCase();
    if (pos.startsWith("G") || row.saves > 0) keeperAcc.push(row);
  }
  for (const clubId of [homeClubId, awayClubId]) {
    const gks = await prisma.player.findMany({
      where: { clubId, position: "GK" },
    });
    for (const gk of gks) {
      if (!gk.apiFootballPlayerId) continue;
      if (keeperAcc.some((k) => k.apiId === gk.apiFootballPlayerId)) continue;
      keeperAcc.push({
        clubId,
        apiId: gk.apiFootballPlayerId,
        name: gk.name,
        goals: 0,
        assists: 0,
        apps: gk.appearances || 0,
        cleanSheets: gk.cleanSheets || 0,
        saves: 0,
        conceded: 0,
        position: "Goalkeeper",
      });
    }
  }

  keeperAcc.sort(
    (a, b) =>
      (b.cleanSheets || 0) - (a.cleanSheets || 0) ||
      (b.saves || 0) - (a.saves || 0) ||
      (b.apps || 0) - (a.apps || 0)
  );

  let keeperRank = 1;
  const seenKeeper = new Set<string>();
  for (const row of keeperAcc) {
    const player = await findClubPlayer(row.clubId, {
      apiId: row.apiId,
      name: row.name,
    });
    if (!player || seenKeeper.has(player.id)) continue;
    seenKeeper.add(player.id);
    const cs = row.cleanSheets || player.cleanSheets || 0;
    const saves = row.saves || 0;
    const apps = row.apps || player.appearances || 0;
    if (!cs && !saves && !apps) continue;
    await prisma.player.update({
      where: { id: player.id },
      data: {
        cleanSheets: cs || player.cleanSheets,
        appearances: apps || player.appearances,
        position: "GK",
      },
    });
    await prisma.seasonKeeper.create({
      data: {
        clubId: row.clubId,
        playerId: player.id,
        cleanSheets: cs,
        saves,
        appearances: apps,
        rank: keeperRank++,
      },
    });
    keepers++;
  }

  return { scorers, keepers, bios };
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

  // Coach nationality/age from /coachs (lineup.coach has no nationality)
  await syncCoachForClub(match.homeClubId, homeAfId).catch(() => null);
  await syncCoachForClub(match.awayClubId, awayAfId).catch(() => null);

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

  const venueWeather = await syncVenueAndWeather(
    matchId,
    fixture,
    match.kickoff
  ).catch(() => ({ venueName: null, weather: null }));

  let statsCount = 0;
  try {
    const rawStats = await getStatistics(match.apiFootballFixtureId);
    if (rawStats.length >= 2) {
      const homeBlock =
        rawStats.find((r) => r.team.id === homeAfId) || rawStats[0];
      const awayBlock =
        rawStats.find((r) => r.team.id === awayAfId) || rawStats[1];
      await prisma.statistic.deleteMany({ where: { matchId } });
      const types = [
        ...new Set([
          ...(homeBlock.statistics || []).map((s) => s.type),
          ...(awayBlock.statistics || []).map((s) => s.type),
        ]),
      ];
      let order = 0;
      for (const type of types) {
        const hv = homeBlock.statistics?.find((s) => s.type === type)?.value;
        const av = awayBlock.statistics?.find((s) => s.type === type)?.value;
        await prisma.statistic.create({
          data: {
            matchId,
            label: type,
            homeValue: hv == null ? "—" : String(hv),
            awayValue: av == null ? "—" : String(av),
            order: order++,
          },
        });
      }
      statsCount = types.length;
    }
  } catch {
    /* stats optional */
  }

  const scorerSync = await syncSeasonScorers(
    match.homeClubId,
    match.awayClubId,
    homeAfId,
    awayAfId,
    fixture.league.id,
    fixture.league.season
  ).catch(() => ({ scorers: 0, keepers: 0 }));

  const events = await getEvents(match.apiFootballFixtureId).catch(() => []);
  const homeScore = fixture.goals.home ?? match.homeScore;
  const awayScore = fixture.goals.away ?? match.awayScore;
  const minute = fixture.fixture.status.elapsed ?? match.minute;
  const status = mapAfStatus(fixture.fixture.status.short);

  const newEvents: { type: string; minute: number; description: string }[] = [];

  for (const ev of events) {
    const elapsed = ev.time?.elapsed ?? 0;
    const desc = `${ev.detail}${ev.player?.name ? ` — ${ev.player.name}` : ""}${
      ev.assist?.name ? ` (${ev.assist.name})` : ""
    }`;
    const type = mapEventType(ev);
    const teamSide =
      ev.team?.id === homeAfId ? "home" : ev.team?.id === awayAfId ? "away" : null;

    const clubId =
      teamSide === "home"
        ? match.homeClubId
        : teamSide === "away"
          ? match.awayClubId
          : null;
    let playerId: string | null = null;
    if (clubId && (ev.player?.id || ev.player?.name)) {
      const pl = await findClubPlayer(clubId, {
        apiId: ev.player?.id,
        name: ev.player?.name,
      });
      playerId = pl?.id ?? null;
    }

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
          playerId,
        },
      });
      newEvents.push({ type, minute: elapsed, description: desc });

      // Auto-pin short note for goals/cards
      if (
        ["goal", "penalty_goal", "own_goal", "yellow", "red", "penalty_miss"].includes(
          type
        )
      ) {
        const already = await prisma.note.findFirst({
          where: {
            matchId,
            title: `${elapsed}' ${type.replace("_", " ")}`,
            body: desc,
          },
        });
        if (!already) {
          await prisma.note.create({
            data: {
              matchId,
              title: `${elapsed}' ${type.replace("_", " ")}`,
              body: desc,
              category: type.includes("goal") || type.includes("penalty") ? "Match" : "Match",
              entityType: playerId ? "player" : "match",
              entityId: playerId || matchId,
              pinned: true,
            },
          });
        }
      }
    } else if (playerId && !existing.playerId) {
      await prisma.matchEvent.update({
        where: { id: existing.id },
        data: { playerId },
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
    newEvents,
    lineupStatus,
    squadHome: squadHome.upserted,
    squadAway: squadAway.upserted,
    injuryCount,
    predictionsAdvice: pred.advice,
    h2hSummary: pred.h2h,
    expectedFrom,
    venueName: venueWeather.venueName,
    weatherSummary: venueWeather.weather,
    statsCount,
    scorersSynced: scorerSync.scorers,
    keepersSynced: scorerSync.keepers,
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
