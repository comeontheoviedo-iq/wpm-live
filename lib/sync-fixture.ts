import { createHash } from "crypto";
import { prisma } from "./prisma";
import {
  clearAllPitchPlacements,
  reapplyPitchPlacements,
} from "./pitch-placement";
import { slotsFor } from "./formations";
import {
  assertFixtureCompatible,
  assignSlotsFromStartXI,
  getEvents,
  getFixture,
  getInjuriesByFixture,
  getLastPlayedLineup,
  getLineups,
  getPredictions,
  getSquads,
  getStatistics,
  getFixturePlayers,
  getTopScorers,
  getPlayersByTeam,
  getPlayerById,
  getVenueById,
  getTeam,
  getCoachById,
  getCoachByTeam,
  searchCoaches,
  mapAfStatus,
  parsePercent,
  summarizeH2h,
  type AfEvent,
  type AfLineup,
  type AfSquadPlayer,
} from "./api-football";
import { leagueIdForCompetition } from "./competitions";
import { resolveWeatherForVenue } from "./weather";
import { nationalityToIso } from "./flags";
import { maybeAutoGenerateLineupPack } from "./pack-generate";
import { maybeReconcileNotesOnXiConfirm } from "./reconcile-notes-on-xi";
import { namesLooselyMatch } from "./player-name";
import {
  aggregateForIngest,
  buildGoalSeasonLines,
  fetchPlayerSeasonSplit,
} from "./season-tally";
import { mapAfFixturePlayersToRows } from "./live-stat-triggers";


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
 * Store birth.country separately for dual nationality flags.
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
    goalsAllComps?: number;
    assistsAllComps?: number;
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
        goalsAllComps: row.goalsAllComps || row.goals || 0,
        assistsAllComps: row.assistsAllComps || row.assists || 0,
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
  if (
    row.goalsAllComps != null &&
    row.goalsAllComps > ((existing as { goalsAllComps?: number }).goalsAllComps || 0)
  ) {
    data.goalsAllComps = row.goalsAllComps;
  }
  if (
    row.assistsAllComps != null &&
    row.assistsAllComps > ((existing as { assistsAllComps?: number }).assistsAllComps || 0)
  ) {
    data.assistsAllComps = row.assistsAllComps;
  }
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
    if (opts.number != null) {
      const byNum = await prisma.player.findFirst({
        where: { clubId, shirtNumber: opts.number },
      });
      if (byNum && namesLooselyMatch(byNum.name, opts.name)) return byNum;
    }
    // Fuzzy: "Lawrence Shankland" ↔ "L. Shankland" / last-name match within club
    const clubPlayers = await prisma.player.findMany({ where: { clubId } });
    const loose = clubPlayers.filter((p) => namesLooselyMatch(p.name, opts.name));
    if (loose.length === 1) return loose[0];
    if (loose.length > 1 && opts.number != null) {
      const byNum = loose.find((p) => p.shirtNumber === opts.number);
      if (byNum) return byNum;
    }
    if (loose.length > 1) {
      // Prefer currently on pitch / starter when ambiguous
      return (
        loose.find((p) => p.onPitch || p.isStarter) ||
        loose.find((p) => p.formationSlot) ||
        loose[0]
      );
    }
  }
  return null;
}


export async function syncSquadForClub(
  clubId: string,
  teamAfId: number,
  opts?: { purgeForeignAfPlayers?: boolean }
) {
  const rows = await getSquads(teamAfId);
  const squad = rows[0];
  if (!squad?.players?.length) return { upserted: 0, purged: 0 };

  const keepAfIds = new Set<number>();
  let upserted = 0;
  for (const p of squad.players as AfSquadPlayer[]) {
    if (p.id) keepAfIds.add(p.id);
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

  let purged = 0;
  if (opts?.purgeForeignAfPlayers !== false && keepAfIds.size) {
    const foreigners = await prisma.player.findMany({
      where: {
        clubId,
        apiFootballPlayerId: { not: null },
      },
      select: { id: true, apiFootballPlayerId: true },
    });
    const dropIds = foreigners
      .filter(
        (p) =>
          p.apiFootballPlayerId != null &&
          !keepAfIds.has(p.apiFootballPlayerId)
      )
      .map((p) => p.id);
    if (dropIds.length) {
      // Clear FKs that would block delete, then remove wrong-league pollution
      await prisma.matchEvent.updateMany({
        where: { playerId: { in: dropIds } },
        data: { playerId: null },
      });
      await prisma.penaltyRecord.updateMany({
        where: { playerId: { in: dropIds } },
        data: { playerId: null },
      });
      await prisma.injury.deleteMany({ where: { playerId: { in: dropIds } } });
      await prisma.seasonScorer.deleteMany({ where: { playerId: { in: dropIds } } });
      await prisma.seasonKeeper.deleteMany({ where: { playerId: { in: dropIds } } });
      await prisma.matchPlayerOverride.deleteMany({
        where: { playerId: { in: dropIds } },
      });
      const del = await prisma.player.deleteMany({
        where: { id: { in: dropIds } },
      });
      purged = del.count;
    }
  }
  return { upserted, purged };
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
          formationSlot: "BENCH",
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
          formationSlot: "BENCH",
          apiFootballPlayerId: p.id || null,
        },
      });
    }
  }

  // Coach is synced separately (current /coachs?team= + confirmed lineup.coach)
  return formation;
}


/** AF grey "NO PHOTO YET" coach media stub (sha256). */
const AF_COACH_PHOTO_STUB_SHA256 =
  "575e4487e3942dd820fe682e8b81f9c59b0b0d60265433ce5bd1884db4004035";

/**
 * Keep only real AF coach headshots. Never invent URLs from coach id.
 * AF often returns a URL pointing at their grey "NO PHOTO YET" stub — drop those.
 */
async function afCoachPhotoOrNull(url?: string | null): Promise<string | null> {
  const u = url?.trim() || null;
  if (!u) return null;
  if (!/^https:\/\/media\.api-sports\.io\/football\/coachs?\//i.test(u)) {
    return null;
  }
  try {
    const res = await fetch(u, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    const hex = createHash("sha256").update(buf).digest("hex");
    if (hex === AF_COACH_PHOTO_STUB_SHA256) return null;
    return u;
  } catch {
    // Network flake: keep URL so UI can try; img onError falls back to placeholder
    return u;
  }
}

function coachNationalityFromAf(
  detail: {
    nationality?: string | null;
    birth?: { country?: string | null } | null;
  } | null,
  existingNat?: string | null,
  teamCountry?: string | null
) {
  const fromAf =
    detail?.nationality?.trim() || detail?.birth?.country?.trim() || null;
  if (fromAf) return fromAf;
  if (existingNat && !isUnsetNationality(existingNat)) return existingNat;
  const fromTeam = teamCountry?.trim() || null;
  if (fromTeam) return fromTeam;
  return "UNK";
}

/**
 * Sync coach name + nationality/age/photo from AF lineup.coach.
 * Lineup.coach only has id/name/photo — fetch /coachs for nationality & age.
 * Store photo only when AF provides a URL (never invent from id).
 * Never default to ENG; use UNK when AF has no nationality.
 */
async function upsertCoachFromLineup(clubId: string, lineup: AfLineup) {
  const name = lineup.coach?.name?.trim();
  if (!name) return;

  // AF often sends lineup.coach.id = 0 for newly appointed HCs (e.g. Jaissle).
  // Never treat 0 as valid, and NEVER fall back to /coachs?team= here — that
  // reintroduces stale open-career names (Howe / Ferguson) over the lineup coach.
  const coachAfId = lineup.coach?.id;
  const validAfId =
    coachAfId != null && Number.isFinite(coachAfId) && coachAfId > 0;
  let detail = validAfId
    ? await getCoachById(coachAfId).catch(() => null)
    : null;
  if (!detail) {
    // AF search is token-picky ("Matthias Jaissle" → []); try full then surname.
    const surname = name.split(/\s+/).filter(Boolean).pop() || name;
    const queries = [...new Set([name, surname].filter((q) => q.length >= 3))];
    let searched: Awaited<ReturnType<typeof searchCoaches>> = [];
    for (const q of queries) {
      searched = await searchCoaches(q).catch(() => []);
      if (searched.length) break;
    }
    detail =
      searched.find((c) => namesLooselyMatch(c.name, name)) ||
      searched.find((c) =>
        namesLooselyMatch(
          `${c.firstname || ""} ${c.lastname || ""}`.trim() || c.name,
          name
        )
      ) ||
      null;
  }
  // Only enrich from detail when it is the same person as the lineup coach.
  if (detail && !namesLooselyMatch(detail.name, name)) {
    detail = null;
  }

  const age =
    detail?.age != null && Number.isFinite(detail.age) ? detail.age : null;
  // Only store AF-provided photo URLs — never invent from coach id.
  // Drop AF's grey "NO PHOTO YET" stub so UI uses our User placeholder.
  const photoUrl = await afCoachPhotoOrNull(
    detail?.photo?.trim() || lineup.coach?.photo?.trim() || null
  );

  const coach = await prisma.coach.findFirst({ where: { clubId } });
  // Keep a single Head Coach row per club
  if (coach) {
    await prisma.coach.deleteMany({ where: { clubId, id: { not: coach.id } } });
  } else {
    await prisma.coach.deleteMany({ where: { clubId } });
  }

  // Lineup name is authoritative; prefer AF detail spelling only for same person.
  const resolvedName = detail?.name?.trim() || name;
  const personChanged =
    Boolean(coach?.name) && !namesLooselyMatch(coach!.name, resolvedName);
  // When the desk HC person changes, do NOT keep the previous coach's nat / AF id.
  const nationality = coachNationalityFromAf(
    detail,
    personChanged ? null : coach?.nationality
  );
  const afCoachId =
    detail?.id && detail.id > 0
      ? detail.id
      : validAfId
        ? coachAfId
        : null;

  if (coach) {
    const patch: Record<string, unknown> = {
      name: resolvedName,
      nationality,
      role: "Head Coach",
      photoUrl,
      // Always write AF id (null clears a stale Howe id left from /coachs?team=)
      apiFootballCoachId: afCoachId,
    };
    if (age != null) patch.age = age;
    else if (personChanged) patch.age = null;
    await prisma.coach.update({ where: { id: coach.id }, data: patch });
  } else {
    await prisma.coach.create({
      data: {
        clubId,
        name: resolvedName,
        nationality,
        age,
        photoUrl,
        apiFootballCoachId: afCoachId,
        role: "Head Coach",
      },
    });
  }
}

/**
 * Set club Head Coach from AF /coachs?team= (prefer current open career).
 * Clears duplicate Coach rows. Preserves a known nationality when AF omits it.
 */
export async function syncCoachForClub(clubId: string, teamAfId: number) {
  // /coachs?team= ranking (open career, latest start). Confirmed desks then
  // overwrite via upsertCoachFromLineup — do NOT probe last-XI here (rate limits).
  const detail = await getCoachByTeam(teamAfId).catch(() => null);
  const existing = await prisma.coach.findFirst({ where: { clubId } });
  if (existing) {
    await prisma.coach.deleteMany({ where: { clubId, id: { not: existing.id } } });
  }

  if (!detail?.name) {
    await prisma.coach.updateMany({
      where: { clubId, nationality: { in: ["ENG", "UNKNOWN", ""] } },
      data: { nationality: "UNK" },
    });
    return null;
  }

  // AF sometimes omits coach nationality (e.g. McInnes) — fall back to team country
  let teamCountry: string | null = null;
  if (!detail.nationality?.trim() && !detail.birth?.country?.trim()) {
    const teamRow = await getTeam(teamAfId).catch(() => null);
    teamCountry = teamRow?.team?.country?.trim() || null;
  }

  const nationality = coachNationalityFromAf(
    detail,
    existing?.nationality,
    teamCountry
  );
  const age =
    detail.age != null && Number.isFinite(detail.age) ? detail.age : null;
  // Only store AF-provided photo URLs — never invent from coach id.
  // Drop AF's grey "NO PHOTO YET" stub so UI uses our User placeholder.
  const photoUrl = await afCoachPhotoOrNull(detail.photo?.trim() || null);

  if (existing) {
    await prisma.coach.update({
      where: { id: existing.id },
      data: {
        name: detail.name,
        nationality,
        role: "Head Coach",
        ...(age != null ? { age } : {}),
        // Set real photo; clear when AF only has the stub / none
        photoUrl: photoUrl,
        ...(detail.id != null ? { apiFootballCoachId: detail.id } : {}),
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
      photoUrl,
      ...(detail.id != null ? { apiFootballCoachId: detail.id } : {}),
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
    const outSince =
      inj.fixture?.date != null
        ? String(inj.fixture.date).slice(0, 10)
        : null;
    // AF sometimes embeds return hints in reason ("Expected back 12/09", "Return Date: …")
    const returnHint =
      reason.match(
        /(?:expected(?:\s+back)?|return(?:\s+date)?|back(?:\s+on)?)[:\s]+([A-Za-z0-9/.-]{4,20})/i
      )?.[1] || null;

    await prisma.injury.create({
      data: {
        matchId,
        clubId,
        playerId: player.id,
        status,
        injuryType: reason,
        expectedReturn: returnHint,
        notes: [
          inj.player?.type || null,
          outSince ? `Out since ${outSince}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
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
  if (outName || ev.player?.id) {
    const outP = await findClubPlayer(clubId, {
      apiId: ev.player?.id,
      name: outName,
    });
    if (outP) {
      inheritedSlot = outP.formationSlot;
      await prisma.player.update({
        where: { id: outP.id },
        data: { onPitch: false, isStarter: false, formationSlot: "BENCH" },
      });
    }
  }
  if (inName || ev.assist?.id) {
    const inP = await findClubPlayer(clubId, {
      apiId: ev.assist?.id ?? null,
      name: inName,
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
 * Desk sync — mode gated for AF diet:
 * - mode "full" (manual Sync / match create / scripts): squads, injuries,
 *   predictions, venue, season scorers, last-XI hunts, coaches, plus live feed.
 * - mode "live" (timed desk/overlay poll): fixture + events + statistics +
 *   lineups when Official XI still needed / NS→live, + fixture players for
 *   card tallies. Never pages players, top scorers, predictions, venue detail,
 *   injuries refresh, coach spam, or last-played lineup hunts on the timer.
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



/** Collapse duplicate AF goal/card rows (same minute+type+player) keeping richest description. */
async function dedupeMatchEvents(matchId: string) {
  const events = await prisma.matchEvent.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
  });
  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = `${e.minute}|${e.type}|${e.playerId || e.description.split("(")[0].trim()}`;
    const list = groups.get(key) || [];
    list.push(e);
    groups.set(key, list);
  }
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => (b.description?.length || 0) - (a.description?.length || 0)
    );
    const keep = sorted[0];
    for (const d of sorted.slice(1)) {
      await prisma.matchEvent.delete({ where: { id: d.id } });
      removed++;
    }
    // If a shorter duplicate was kept earlier, ensure keep has richest text (already)
    void keep;
  }
  return removed;
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



function evTeamAfForPlayer(
  afPlayerId: number,
  events: AfEvent[],
  homeAfId: number,
  awayAfId: number
): number | null {
  for (const ev of events) {
    if (ev.player?.id === afPlayerId || ev.assist?.id === afPlayerId) {
      if (ev.team?.id === homeAfId || ev.team?.id === awayAfId) return ev.team.id;
    }
  }
  return null;
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
    goalsAllComps: number;
    assistsAllComps: number;
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
    const teamId =
      row.statistics?.find((s) => s.team?.id && clubByAf.has(s.team.id))?.team
        ?.id ?? row.statistics?.[0]?.team?.id;
    const clubId = teamId && clubByAf.has(teamId) ? clubByAf.get(teamId)! : null;
    if (!clubId || !row.player?.id) return;
    const agg = aggregateForIngest(row.statistics, leagueId, teamId);
    const saves = row.statistics?.find((s) => s.league?.id === leagueId)?.goals
      ?.saves ?? row.statistics?.[0]?.goals?.saves ?? 0;
    const conceded =
      row.statistics?.find((s) => s.league?.id === leagueId)?.goals?.conceded ??
      row.statistics?.[0]?.goals?.conceded ??
      0;
    const rawRating =
      row.statistics?.find((s) => s.league?.id === leagueId)?.games?.rating ??
      row.statistics?.[0]?.games?.rating;
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
      // Competition (desk league) — do not take statistics[0] cup/UCL row alone
      goals: Math.max(agg.leagueGoals || 0, prev?.goals || 0),
      assists: Math.max(agg.leagueAssists || 0, prev?.assists || 0),
      goalsAllComps: Math.max(agg.allGoals || 0, prev?.goalsAllComps || 0),
      assistsAllComps: Math.max(agg.allAssists || 0, prev?.assistsAllComps || 0),
      apps: Math.max(agg.leagueApps || 0, prev?.apps || 0),
      cleanSheets: prev?.cleanSheets || 0,
      saves: Math.max(saves || 0, prev?.saves || 0),
      conceded: Math.max(conceded || 0, prev?.conceded || 0),
      position: agg.position || prev?.position,
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
      goalsAllComps: prev?.goalsAllComps || prev?.goals || 0,
      assistsAllComps: prev?.assistsAllComps || prev?.assists || 0,
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
        goalsAllComps: 0,
        assistsAllComps: 0,
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


/** Persist AF fixture.referee when present — never invent a name. */
async function syncRefereeFromFixture(matchId: string, refereeName?: string | null) {
  const name = (refereeName || "").trim();
  if (!name) return null;
  // AF often returns "Name, Country"
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  const display = parts[0] || name;
  const nationality = parts[1] || "UNK";

  let official = await prisma.official.findFirst({
    where: { name: display, role: "Referee" },
  });
  if (!official) {
    official = await prisma.official.create({
      data: {
        name: display,
        role: "Referee",
        nationality: nationality.length <= 24 ? nationality : "UNK",
      },
    });
  } else if (nationality !== "UNK" && official.nationality === "UNK") {
    official = await prisma.official.update({
      where: { id: official.id },
      data: { nationality },
    });
  }

  await prisma.matchOfficial.deleteMany({
    where: { matchId, role: "Referee" },
  });
  await prisma.matchOfficial.create({
    data: { matchId, officialId: official.id, role: "Referee" },
  });
  return display;
}

export type SyncMode = "live" | "full";

/** One in-flight sync writer per matchId so desk+overlay+tabs coalesce. */
const syncInflight = new Map<string, Promise<unknown>>();

export async function syncMatchFromApiFootball(
  matchId: string,
  opts?: { resetPlacements?: boolean; mode?: SyncMode }
) {
  const mode: SyncMode = opts?.mode === "live" ? "live" : "full";

  const existing = syncInflight.get(matchId);
  if (existing) {
    if (mode === "live") {
      // Live polls share whatever is already running (live or full).
      return existing as ReturnType<typeof runSyncMatchFromApiFootball>;
    }
    // Full Sync waits for the in-flight pass, then runs full enrich.
    await existing.catch(() => null);
  }

  const run = runSyncMatchFromApiFootball(matchId, {
    resetPlacements: opts?.resetPlacements,
    mode,
  }).finally(() => {
    if (syncInflight.get(matchId) === run) syncInflight.delete(matchId);
  });
  syncInflight.set(matchId, run);
  return run;
}

async function runSyncMatchFromApiFootball(
  matchId: string,
  opts: { resetPlacements?: boolean; mode: SyncMode }
) {
  const mode = opts.mode;
  const isLive = mode === "live";

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeClub: true, awayClub: true },
  });
  if (!match) throw new Error("Match not found");
  if (!match.apiFootballFixtureId) {
    throw new Error("Match has no apiFootballFixtureId linked");
  }

  if (opts?.resetPlacements) {
    await clearAllPitchPlacements(matchId);
  }

  const fixture = await getFixture(match.apiFootballFixtureId);
  if (!fixture) throw new Error("Fixture not found on API-Football");

  const deskHomeAf = match.homeClub.apiFootballTeamId ?? null;
  const deskAwayAf = match.awayClub.apiFootballTeamId ?? null;
  const matchDay = await prisma.matchDay.findUnique({
    where: { id: match.matchDayId },
    select: { competition: true },
  });
  const expectedLeagueId = matchDay?.competition
    ? leagueIdForCompetition(matchDay.competition)
    : null;

  const compat = assertFixtureCompatible({
    fixture,
    homeAfId: deskHomeAf,
    awayAfId: deskAwayAf,
    leagueId: expectedLeagueId,
  });
  if (!compat.ok) {
    throw new Error(
      compat.reason ||
        "Linked fixture does not match this desk's clubs/competition — unlink or pick the correct AF fixture."
    );
  }

  await syncRefereeFromFixture(
    matchId,
    fixture.fixture.referee
  ).catch(() => null);

  // Prefer desk club AF ids once known; only fill missing from a *validated* fixture.
  const homeAfId = deskHomeAf ?? fixture.teams.home.id;
  const awayAfId = deskAwayAf ?? fixture.teams.away.id;

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

  let squadHome = { upserted: 0, purged: 0 };
  let squadAway = { upserted: 0, purged: 0 };
  let injuryCount = 0;
  let pred: { advice: string | null; h2h: string | null } = {
    advice: null,
    h2h: null,
  };

  if (!isLive) {
    squadHome = await syncSquadForClub(match.homeClubId, homeAfId, {
      purgeForeignAfPlayers: true,
    }).catch(() => ({ upserted: 0, purged: 0 }));
    squadAway = await syncSquadForClub(match.awayClubId, awayAfId, {
      purgeForeignAfPlayers: true,
    }).catch(() => ({ upserted: 0, purged: 0 }));

    injuryCount = await syncInjuriesForMatch(
      matchId,
      match.apiFootballFixtureId,
      match.homeClubId,
      match.awayClubId,
      homeAfId,
      awayAfId
    ).catch(() => 0);

    pred = await syncPredictionsForMatch(
      matchId,
      match.apiFootballFixtureId,
      homeAfId,
      awayAfId
    ).catch(() => ({ advice: null, h2h: null }));
  }

  // Lineups on live only when Official XI still needed or pre-live transition.
  const afStatusShort = fixture.fixture.status.short || "";
  const isPreOrNs =
    ["NS", "TBD", "PST", "SUSP"].includes(afStatusShort) ||
    ["Not Started", "Assigned", "Preparation", "Ready", "Scheduled"].includes(
      match.status
    );
  const needLineups =
    !isLive ||
    match.lineupStatus !== "confirmed" ||
    isPreOrNs;

  const lineups = needLineups
    ? await getLineups(match.apiFootballFixtureId).catch(() => [])
    : [];
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
    if (!isLive) {
      await applyPredictedJson(match.homeClubId, match.predictedHomeJson);
      await applyPredictedJson(match.awayClubId, match.predictedAwayJson);
    }
    lineupStatus = "predicted";
  } else if (!isLive) {
    // Expected XI = last finished lineup — full enrich only (expensive hunt).
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
  } else {
    // Live poll without Official XI yet — keep prior board; do not hunt last XI.
    lineupStatus = match.lineupStatus || "expected";
  }

  // Confirmed XI: lineup.coach is authoritative (may have id 0; search surname).
  // Skip /coachs?team= on confirmed desks — open careers still rank Howe/Ferguson.
  // Live: never spam getCoachByTeam; only upsert from lineup payload when present.
  if (lineupStatus === "confirmed" && lineups.length) {
    for (const lu of lineups) {
      if (!lu.coach?.name) continue;
      if (lu.team.id === homeAfId) {
        await upsertCoachFromLineup(match.homeClubId, lu).catch(() => null);
      } else if (lu.team.id === awayAfId) {
        await upsertCoachFromLineup(match.awayClubId, lu).catch(() => null);
      }
    }
  } else if (!isLive) {
    await syncCoachForClub(match.homeClubId, homeAfId).catch(() => null);
    await syncCoachForClub(match.awayClubId, awayAfId).catch(() => null);
  }

  const venueWeather = isLive
    ? { venueName: null as string | null, weather: null as string | null }
    : await syncVenueAndWeather(matchId, fixture, match.kickoff).catch(() => ({
        venueName: null as string | null,
        weather: null as string | null,
      }));

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

  // Per-player live tallies (AF /fixtures/players) — ephemeral on sync JSON
  let livePlayerStats: ReturnType<typeof mapAfFixturePlayersToRows> = [];
  try {
    const fp = await getFixturePlayers(match.apiFootballFixtureId);
    if (fp?.length) {
      const squadRows = await prisma.player.findMany({
        where: {
          clubId: { in: [match.homeClubId, match.awayClubId] },
          apiFootballPlayerId: { not: null },
        },
        select: { id: true, apiFootballPlayerId: true },
      });
      const localByAfId = new Map<number, string>();
      for (const pl of squadRows) {
        if (pl.apiFootballPlayerId != null) {
          localByAfId.set(pl.apiFootballPlayerId, pl.id);
        }
      }
      livePlayerStats = mapAfFixturePlayersToRows({
        teams: fp,
        homeAfTeamId: homeAfId,
        awayAfTeamId: awayAfId,
        localByAfId,
      });
    }
  } catch {
    /* player live stats optional — soft-fail */
  }

  const scorerSync = isLive
    ? { scorers: 0, keepers: 0 }
    : await syncSeasonScorers(
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
  const minuteExtraRaw = fixture.fixture.status.extra;
  const minuteExtra =
    minuteExtraRaw != null && Number.isFinite(Number(minuteExtraRaw))
      ? Math.floor(Number(minuteExtraRaw))
      : null;
  const status = mapAfStatus(fixture.fixture.status.short);
  const competitionName =
    fixture.league?.name?.trim() ||
    matchDay?.competition ||
    "This competition";

  const newEvents: {
    type: string;
    minute: number;
    description: string;
    playerId?: string | null;
    /** Pre-built season tally lines for rich goal popups */
    seasonLines?: string[];
    assistSeasonLines?: string[];
  }[] = [];

  // Running in-match goal/assist counts (AF player id) for ordinal math
  const matchGoalCountByAf = new Map<number, number>();
  const matchAssistCountByAf = new Map<number, number>();

  for (const ev of events) {
    const elapsed = ev.time?.elapsed ?? 0;
    const desc = `${ev.detail}${ev.player?.name ? ` — ${ev.player.name}` : ""}${
      ev.assist?.name ? ` (${ev.assist.name})` : ""
    }`;
    const type = mapEventType(ev);
    const isGoalType =
      type === "goal" || type === "penalty_goal" || type === "own_goal";
    const isSeasonGoal = type === "goal" || type === "penalty_goal";
    if (isSeasonGoal && ev.player?.id) {
      matchGoalCountByAf.set(
        ev.player.id,
        (matchGoalCountByAf.get(ev.player.id) || 0) + 1
      );
    }
    if (isSeasonGoal && ev.assist?.id) {
      matchAssistCountByAf.set(
        ev.assist.id,
        (matchAssistCountByAf.get(ev.assist.id) || 0) + 1
      );
    }
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

    // Prefer same minute+type+player (description can grow when assist arrives)
    let existing = await prisma.matchEvent.findFirst({
      where: {
        matchId,
        minute: elapsed,
        type,
        ...(playerId
          ? { playerId }
          : { description: desc }),
      },
      orderBy: { createdAt: "asc" },
    });
    if (!existing) {
      existing = await prisma.matchEvent.findFirst({
        where: { matchId, minute: elapsed, type, description: desc },
      });
    }
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
      let seasonLines: string[] | undefined;
      let assistSeasonLines: string[] | undefined;
      if (isSeasonGoal) {
        try {
          const scorerAf = ev.player?.id || null;
          const assistAf = ev.assist?.id || null;
          const scorerTeamAf =
            ev.team?.id === homeAfId
              ? homeAfId
              : ev.team?.id === awayAfId
                ? awayAfId
                : null;
          if (scorerAf) {
            const split = await fetchPlayerSeasonSplit(
              scorerAf,
              fixture.league.season,
              fixture.league.id,
              competitionName,
              scorerTeamAf
            );
            const inMatch = matchGoalCountByAf.get(scorerAf) || 1;
            const built = buildGoalSeasonLines({
              kind: "goal",
              split: split!,
              inMatchCount: inMatch,
              indexInMatch: inMatch,
              matchStatus: status,
            });
            seasonLines = built.lines;
          }
          if (assistAf) {
            const assistTeamAf = scorerTeamAf;
            const splitA = await fetchPlayerSeasonSplit(
              assistAf,
              fixture.league.season,
              fixture.league.id,
              competitionName,
              assistTeamAf
            );
            const inMatchA = matchAssistCountByAf.get(assistAf) || 1;
            const builtA = buildGoalSeasonLines({
              kind: "assist",
              split: splitA!,
              inMatchCount: inMatchA,
              indexInMatch: inMatchA,
              matchStatus: status,
            });
            assistSeasonLines = builtA.lines;
          }
        } catch (err) {
          console.error("[sync] season tally for popup failed", err);
        }
      }
      newEvents.push({
        type,
        minute: elapsed,
        description: desc,
        playerId,
        seasonLines,
        assistSeasonLines,
      });

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
    } else {
      const patch: {
        playerId?: string;
        description?: string;
        teamSide?: string | null;
      } = {};
      if (playerId && !existing.playerId) patch.playerId = playerId;
      if (
        desc &&
        desc !== existing.description &&
        desc.length > (existing.description || "").length
      ) {
        patch.description = desc;
      }
      if (teamSide && !existing.teamSide) patch.teamSide = teamSide;
      if (Object.keys(patch).length) {
        await prisma.matchEvent.update({
          where: { id: existing.id },
          data: patch,
        });
      }
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

  // Do NOT write live-adjusted season G/A into Player.* here.
  // Player.goals/assists/appearances stay as the AF season snapshot;
  // pitch cards add today's match contribution at display time
  // (liveAdjustedSeasonStat). Writing seasonOrdinal bumps caused
  // double-count (e.g. Mbeumo DB=2 + card +1 → 3).

  await dedupeMatchEvents(matchId).catch((err) =>
    console.error("[sync] dedupe events failed", matchId, err)
  );

  if (lineupStatus === "confirmed") {
    await dedupeClubSlots(match.homeClubId, homeFormation);
    await dedupeClubSlots(match.awayClubId, awayFormation);
  }

  // After AF XI + live subs + dedupe: re-apply commentary DnD placements
  await reapplyPitchPlacements(matchId).catch((err) =>
    console.error("[sync] reapply placements failed", matchId, err)
  );

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      homeScore,
      awayScore,
      minute,
      minuteExtra,
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

  const previousStatus = match.lineupStatus || "expected";
  let lineupPack: { triggered: boolean; reason: string } | null = null;
  let notesReconcile: {
    triggered: boolean;
    reason: string;
  } | null = null;
  if (lineupStatus === "confirmed") {
    // Fire-and-forget so sync stays fast; await only the decision kickoff
    void maybeAutoGenerateLineupPack({
      matchId,
      previousStatus,
      newStatus: lineupStatus,
    })
      .then((r) => {
        if (r.triggered) {
          console.info("[sync] auto lineup pack", matchId, r.reason);
        }
      })
      .catch((err) => console.error("[sync] auto lineup pack failed", matchId, err));
    lineupPack = { triggered: true, reason: "queued" };
    // Refine: if already confirmed same XI, maybeAuto… returns quickly — still ok

    // Purge out-of-squad player notes + soft-create Bios from Research packs
    void maybeReconcileNotesOnXiConfirm({
      matchId,
      previousStatus,
      newStatus: lineupStatus,
    })
      .then((r) => {
        if (r.triggered) {
          console.info(
            "[sync] reconcile notes on XI",
            matchId,
            r.reason,
            `purged=${r.purged}`,
            `createdPlayers=${r.createdPlayers}`,
            `createdCoaches=${r.createdCoaches}`,
            `squad=${r.squadSize}`
          );
        }
      })
      .catch((err) =>
        console.error("[sync] reconcile notes on XI failed", matchId, err)
      );
    notesReconcile = { triggered: true, reason: "queued" };
  }

  return {
    match: updated,
    mode,
    lineupCount: lineups.length,
    eventCount: events.length,
    newEvents,
    lineupStatus,
    previousLineupStatus: previousStatus,
    lineupPack,
    notesReconcile,
    squadHome: squadHome.upserted,
    squadAway: squadAway.upserted,
    injuryCount,
    predictionsAdvice: pred.advice,
    h2hSummary: pred.h2h,
    expectedFrom,
    venueName: venueWeather.venueName,
    weatherSummary: venueWeather.weather,
    statsCount,
    livePlayerStats,
    scorersSynced: scorerSync.scorers,
    keepersSynced: scorerSync.keepers,
  };
}

export async function linkFixtureToMatch(
  matchId: string,
  apiFootballFixtureId: number
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeClub: true,
      awayClub: true,
      matchDay: { select: { competition: true } },
    },
  });
  if (!match) throw new Error("Match not found");

  const fixture = await getFixture(apiFootballFixtureId);
  if (!fixture) throw new Error(`Fixture #${apiFootballFixtureId} not found on API-Football`);

  const expectedLeagueId = match.matchDay?.competition
    ? leagueIdForCompetition(match.matchDay.competition)
    : null;
  const compat = assertFixtureCompatible({
    fixture,
    homeAfId: match.homeClub.apiFootballTeamId,
    awayAfId: match.awayClub.apiFootballTeamId,
    leagueId: expectedLeagueId,
  });
  if (!compat.ok) {
    throw new Error(compat.reason || "Fixture does not match this desk");
  }

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
