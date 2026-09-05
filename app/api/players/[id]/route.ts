import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { europeanSeasonYear } from "@/lib/season";
import {
  getPlayerById,
  getPlayerTeams,
  getPlayerTransfers,
  getPlayerSidelined,
  getPlayerFormViaTeam,
  getPlayerProfile,
  getFixturePlayers,
  getPlayerTrophies,
} from "@/lib/api-football";
import { nationalityToIso } from "@/lib/flags";

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

/** Never leak turbopack / stack / prisma internals to the client. */
function friendlyAfStub(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e || "");
  if (
    /TURBOPACK|__TURBOPACK__|prisma|stack|at\s+\S+\s+\(/i.test(raw) ||
    raw.length > 160
  ) {
    return "Stats temporarily unavailable";
  }
  if (/timeout/i.test(raw)) return "Stats temporarily unavailable";
  if (/not\s+set|API_FOOTBALL/i.test(raw)) return "Stats temporarily unavailable";
  return "Stats temporarily unavailable";
}

type AfStatRow = {
  team?: { id?: number; name?: string; logo?: string } | null;
  league?: {
    id?: number;
    name?: string;
    country?: string | null;
    season?: number;
  } | null;
  games?: {
    appearences?: number | null;
    lineups?: number | null;
    minutes?: number | null;
    position?: string | null;
    rating?: string | number | null;
  };
  goals?: {
    total?: number | null;
    assists?: number | null;
    saves?: number | null;
    conceded?: number | null;
  };
  cards?: { yellow?: number | null; red?: number | null };
};

type CareerClub = {
  teamId: number | null;
  name: string;
  logo?: string | null;
  seasons: number[];
  apps: number;
  goals: number;
  assists: number;
};

function aggregateCareer(
  teams: { team: { id: number; name: string; logo?: string }; seasons: number[] }[],
  seasonRows: { season: number; statistics: AfStatRow[] }[]
): CareerClub[] {
  const byId = new Map<number, CareerClub>();
  for (const t of teams) {
    byId.set(t.team.id, {
      teamId: t.team.id,
      name: t.team.name,
      logo: t.team.logo || null,
      seasons: [...(t.seasons || [])].sort((a, b) => b - a),
      apps: 0,
      goals: 0,
      assists: 0,
    });
  }
  for (const block of seasonRows) {
    for (const s of block.statistics || []) {
      const id = s.team?.id;
      const name = s.team?.name?.trim();
      if (!name) continue;
      const key = id ?? -Math.abs(hashName(name));
      let row = id != null ? byId.get(id) : undefined;
      if (!row) {
        row = {
          teamId: id ?? null,
          name,
          logo: s.team?.logo || null,
          seasons: [],
          apps: 0,
          goals: 0,
          assists: 0,
        };
        if (id != null) byId.set(id, row);
        else byId.set(key, row);
      }
      if (block.season && !row.seasons.includes(block.season)) {
        row.seasons.push(block.season);
        row.seasons.sort((a, b) => b - a);
      }
      row.apps += s.games?.appearences ?? 0;
      row.goals += s.goals?.total ?? 0;
      row.assists += s.goals?.assists ?? 0;
    }
  }
  return [...byId.values()].sort((a, b) => {
    const sa = a.seasons[0] ?? 0;
    const sb = b.seasons[0] ?? 0;
    if (sb !== sa) return sb - sa;
    return b.apps - a.apps;
  });
}

function hashName(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId");

  let player = await prisma.player.findUnique({
    where: { id },
    include: {
      club: true,
      scorers: { orderBy: { rank: "asc" }, take: 5 },
      keepers: { orderBy: { rank: "asc" }, take: 5 },
    },
  });
  if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const notes = matchId
    ? await prisma.note.findMany({
        where: {
          matchId,
          entityId: id,
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      })
    : await prisma.note.findMany({
        where: { entityId: id },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: 40,
      });

  const injuries = await prisma.injury.findMany({
    where: {
      playerId: id,
      ...(matchId ? { OR: [{ matchId }, { matchId: null }] } : {}),
    },
    orderBy: { injuryType: "asc" },
    take: 8,
  });

  const events = matchId
    ? await prisma.matchEvent.findMany({
        where: {
          matchId,
          OR: [
            { playerId: id },
            { description: { contains: player.name } },
          ],
        },
        orderBy: [{ minute: "desc" }, { createdAt: "desc" }],
        take: 30,
      })
    : [];

  let afStats: unknown = null;
  let afStub: string | null = null;
  let careerClubs: CareerClub[] = [];
  let careerSeasons: {
    season: number;
    competitions: {
      league: string;
      country?: string | null;
      team: string;
      apps: number | null;
      goals: number | null;
      assists: number | null;
      minutes: number | null;
      rating: string | number | null;
      yellow?: number | null;
      red?: number | null;
      lineups?: number | null;
      leagueLogo?: string | null;
    }[];
  }[] = [];
  let recentForm: {
    date: string;
    opponent: string;
    opponentLogo?: string | null;
    league?: string | null;
    leagueLogo?: string | null;
    result: "W" | "D" | "L" | null;
    homeAway: "H" | "A" | null;
    score: string;
    rating: string | null;
    started: boolean | null;
    minutes: number | null;
    goals: number | null;
    assists: number | null;
    yellow: number | null;
    red: number | null;
  }[] = [];
  let transfers: {
    date: string;
    type: string | null;
    from: { id?: number; name: string; logo?: string | null };
    to: { id?: number; name: string; logo?: string | null };
  }[] = [];
  let afSidelined: { type: string; start: string | null; end: string | null }[] = [];
  let matchPlayerStats: Record<string, unknown> | null = null;
  let trophies: { league: string; country?: string | null; season?: string | null; place?: string | null }[] = [];
  let opponentClub: { id: string; name: string; shortName: string; apiFootballTeamId: number | null } | null = null;


  if (player.apiFootballPlayerId) {
    try {
      const season = europeanSeasonYear(new Date());
      const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          p,
          new Promise<T>((_, rej) =>
            setTimeout(() => rej(new Error("AF player stats timeout")), ms)
          ),
        ]);

      const afId = player.apiFootballPlayerId;
      const clubAf = player.club.apiFootballTeamId;

      // Parallel soft fetches — never fail the dossier for enrichments
      const [profileRes, teamsRes, transfersRes, sidelinedRes, trophiesRes, formRes, curSeasonRes] =
        await Promise.all([
          withTimeout(getPlayerProfile(afId), 3500).catch(() => null),
          withTimeout(getPlayerTeams(afId), 3500).catch(() => [] as Awaited<ReturnType<typeof getPlayerTeams>>),
          withTimeout(getPlayerTransfers(afId), 3500).catch(() => []),
          withTimeout(getPlayerSidelined(afId), 3000).catch(() => []),
          withTimeout(getPlayerTrophies(afId), 3000).catch(() => []),
          clubAf
            ? withTimeout(getPlayerFormViaTeam(afId, clubAf, 5), 9000).catch(() => [])
            : Promise.resolve([]),
          withTimeout(getPlayerById(afId, season), 4000).catch(() => null),
        ]);

      let rows = curSeasonRes;
      if (!rows?.[0]) {
        rows = await withTimeout(getPlayerById(afId, season - 1), 3000).catch(() => null);
      }
      afStats = rows?.[0] || null;

      const profilePlayer = profileRes?.player || null;
      const rowPlayer = (rows?.[0] as { player?: Record<string, unknown> } | null)?.player || null;

      if (!afStats && !profilePlayer) {
        afStub = "Stats temporarily unavailable";
      } else {
        const patch: Record<string, unknown> = {};
        const photo =
          (rowPlayer?.photo as string | undefined) ||
          profilePlayer?.photo ||
          null;
        if (photo && !player.photoUrl) patch.photoUrl = photo;
        const h = parseCm(
          (rowPlayer?.height as string | undefined) || profilePlayer?.height || null
        );
        if (h && !player.heightCm) patch.heightCm = h;
        const w = parseKg(
          (rowPlayer?.weight as string | undefined) || profilePlayer?.weight || null
        );
        if (w && !player.weightKg) patch.weightKg = w;
        const birthDate =
          (rowPlayer?.birth as { date?: string } | undefined)?.date ||
          profilePlayer?.birth?.date ||
          null;
        if (birthDate && !player.birthDate) patch.birthDate = birthDate;
        const birthCountry =
          (rowPlayer?.birth as { country?: string | null } | undefined)?.country?.trim() ||
          profilePlayer?.birth?.country?.trim() ||
          null;
        if (birthCountry && player.birthCountry !== birthCountry)
          patch.birthCountry = birthCountry;
        const footRaw =
          (rowPlayer?.foot as string | undefined) ||
          (profilePlayer?.foot as string | undefined) ||
          null;
        if (footRaw && !player.preferredFoot) patch.preferredFoot = footRaw;
        const afNat =
          ((rowPlayer?.nationality as string | undefined) ||
            profilePlayer?.nationality ||
            "").trim() || null;
        let nt: string | null = null;
        let bestApps = 0;
        for (const s of ((rows?.[0] as { statistics?: AfStatRow[] } | null)?.statistics || [])) {
          const teamName = s.team?.name?.trim();
          if (!teamName) continue;
          if (
            /\b(fc|cf|sc|afc|united|city|athletic|rovers|wanderers|albion|hotspur|town|borough)\b/i.test(
              teamName
            )
          )
            continue;
          if (!nationalityToIso(teamName)) continue;
          const league = s.league?.name || "";
          const intl =
            /world cup|friendlies|nations|africa cup|afcon|\beuro\b|copa|asian cup|gold cup|olympics|qualification|confederations|uefa nations|african nations/i.test(
              league
            );
          const apps = s.games?.appearences ?? 0;
          if (!intl || apps <= 0) continue;
          if (apps > bestApps) {
            bestApps = apps;
            nt = teamName;
          }
        }
        const nat = nt || afNat;
        if (nat) {
          const cur = (player.nationality || "").trim().toUpperCase();
          if (cur === "" || cur === "ENG" || cur === "UNK" || player.nationality !== nat)
            patch.nationality = nat;
        }
        const age =
          (rowPlayer?.age as number | undefined) || profilePlayer?.age || null;
        if (age && !player.age) patch.age = age;
        const statsAll =
          ((rows?.[0] as { statistics?: AfStatRow[] } | null)?.statistics || []);
        const clubStats = clubAf
          ? statsAll.filter((s) => s.team?.id === clubAf)
          : statsAll;
        const pickPool = clubStats.length ? clubStats : statsAll;
        // Prefer domestic league row for headline rating; else first club row
        const af =
          pickPool.find((s) =>
            /premier league|la liga|serie a|bundesliga|ligue 1|championship|eredivisie|liga portugal|süper lig|super lig|scottish premiership/i.test(
              s.league?.name || ""
            )
          ) || pickPool[0];
        const rt = af?.games?.rating;
        if (rt != null && rt !== "") {
          const n = Number(rt);
          if (Number.isFinite(n)) patch.rating = n;
        }
        // Season totals for current club across competitions (overwrite thin sync tallies)
        if (pickPool.length) {
          const apps = pickPool.reduce((n, s) => n + (s.games?.appearences ?? 0), 0);
          const goals = pickPool.reduce((n, s) => n + (s.goals?.total ?? 0), 0);
          const assists = pickPool.reduce((n, s) => n + (s.goals?.assists ?? 0), 0);
          if (apps > 0) patch.appearances = apps;
          patch.goals = goals;
          patch.assists = assists;
        }
        if (Object.keys(patch).length) {
          player = await prisma.player.update({
            where: { id: player.id },
            data: patch,
            include: {
              club: true,
              scorers: { orderBy: { rank: "asc" }, take: 5 },
              keepers: { orderBy: { rank: "asc" }, take: 5 },
            },
          });
        }
      }

      const teams = teamsRes || [];
      // Career seasons: union of team seasons + current, newest first, cap ~10
      const yearSet = new Set<number>([season, season - 1]);
      for (const t of teams) {
        for (const y of t.seasons || []) {
          if (typeof y === "number" && y >= season - 9) yearSet.add(y);
        }
      }
      const seasonYears = [...yearSet].sort((a, b) => b - a).slice(0, 8);
      const seasonRows: { season: number; statistics: AfStatRow[] }[] = [];
      if (rows?.[0]?.statistics?.length) {
        seasonRows.push({
          season,
          statistics: (rows[0].statistics || []) as AfStatRow[],
        });
      }

      const missingYears = seasonYears.filter((y) => !seasonRows.some((s) => s.season === y));
      // Batch to avoid AF rate spikes; prefer newest seasons first
      for (let i = 0; i < missingYears.length; i += 4) {
        const chunk = missingYears.slice(i, i + 4);
        const fetched = await Promise.all(
          chunk.map(async (y) => {
            const block = await withTimeout(getPlayerById(afId, y), 3500).catch(() => null);
            if (block?.[0]?.statistics?.length) {
              return {
                season: y,
                statistics: block[0].statistics as AfStatRow[],
              };
            }
            return null;
          })
        );
        for (const b of fetched) {
          if (b && !seasonRows.some((s) => s.season === b.season)) seasonRows.push(b);
        }
      }

      // Transfers
      try {
        const flat: typeof transfers = [];
        for (const row of transfersRes || []) {
          for (const x of row.transfers || []) {
            flat.push({
              date: x.date || "",
              type: x.type || null,
              from: {
                id: x.teams?.out?.id,
                name: x.teams?.out?.name || "—",
                logo: x.teams?.out?.logo || null,
              },
              to: {
                id: x.teams?.in?.id,
                name: x.teams?.in?.name || "—",
                logo: x.teams?.in?.logo || null,
              },
            });
          }
        }
        transfers = flat
          .filter((x) => x.date)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 12);
      } catch { /* soft */ }

      afSidelined = (sidelinedRes || [])
        .map((s) => ({
          type: s.type || "Sidelined",
          start: s.start || null,
          end: s.end || null,
        }))
        .slice(0, 20);

      trophies = (trophiesRes || [])
        .map((x) => ({
          league: x.league || "Trophy",
          country: x.country || null,
          season: x.season || null,
          place: x.place || null,
        }))
        .slice(0, 40);

      recentForm = (formRes || []).map((row) => ({
        date: row.date,
        opponent: row.opponent,
        opponentLogo: row.opponentLogo,
        league: row.league,
        leagueLogo: row.leagueLogo,
        result: row.result,
        homeAway: row.homeAway,
        score: row.score,
        rating: row.rating,
        started: row.started,
        minutes: row.minutes,
        goals: row.goals,
        assists: row.assists,
        yellow: row.yellow,
        red: row.red,
      }));

      if (matchId) {
        try {
          const m = await prisma.match.findUnique({
            where: { id: matchId },
            include: { homeClub: true, awayClub: true },
          });
          if (m) {
            const isHome = m.homeClubId === player.clubId;
            opponentClub = {
              id: isHome ? m.awayClub.id : m.homeClub.id,
              name: isHome ? m.awayClub.name : m.homeClub.name,
              shortName: isHome ? m.awayClub.shortName : m.homeClub.shortName,
              apiFootballTeamId: isHome
                ? m.awayClub.apiFootballTeamId
                : m.homeClub.apiFootballTeamId,
            };
            if (m.apiFootballFixtureId) {
              const fp = await withTimeout(
                getFixturePlayers(m.apiFootballFixtureId),
                3000
              ).catch(() => null);
              if (fp) {
                for (const teamBlock of fp) {
                  for (const pl of teamBlock.players || []) {
                    if (pl.player?.id === afId) {
                      matchPlayerStats = pl.statistics?.[0] || null;
                    }
                  }
                }
              }
            }
          }
        } catch { /* soft */ }
      }

      careerClubs = aggregateCareer(teams || [], seasonRows);
      careerSeasons = seasonRows
        .map((block) => ({
          season: block.season,
          competitions: (block.statistics || []).map((s) => ({
            league: s.league?.name || "Competition",
            country: s.league?.country || null,
            team: s.team?.name || "—",
            apps: s.games?.appearences ?? null,
            goals: s.goals?.total ?? null,
            assists: s.goals?.assists ?? null,
            minutes: s.games?.minutes ?? null,
            rating: s.games?.rating ?? null,
            yellow: s.cards?.yellow ?? null,
            red: s.cards?.red ?? null,
            lineups: s.games?.lineups ?? null,
            leagueLogo: (s.league as { logo?: string } | undefined)?.logo || null,
          })),
        }))
        .filter((b) => b.competitions.length > 0)
        .sort((a, b) => b.season - a.season);
    } catch (e) {
      console.error("[players/:id] AF stats failed", e instanceof Error ? e.message : e);
      afStub = friendlyAfStub(e);
    }
  } else {
    afStub = "Stats temporarily unavailable";
  }

  const lastGoal =
    recentForm.find((r) => (r.goals || 0) > 0) ||
    null;

  const photoUrl =
    player.photoUrl ||
    (player.apiFootballPlayerId
      ? `https://media.api-sports.io/football/players/${player.apiFootballPlayerId}.png`
      : null);

  // Prefer AF firstname+lastname when DB only has "L. Shankland"-style short name
  const afPlayer = (afStats as { player?: { firstname?: string; lastname?: string; name?: string } } | null)
    ?.player;
  const afFull = [afPlayer?.firstname, afPlayer?.lastname]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
  const looksInitial =
    /^[A-Z]\.?\s/.test(player.name.trim()) ||
    /^[A-Z]\.\s*[A-Z]/.test(player.name.trim());
  const fullName =
    afFull ||
    (looksInitial && afPlayer?.name && afPlayer.name.length > player.name.length
      ? afPlayer.name
      : null) ||
    player.name;

  return NextResponse.json({
    player: {
      id: player.id,
      name: fullName,
      shortName: player.name,
      shirtNumber: player.shirtNumber,
      position: player.position,
      nationality: player.nationality,
      birthCountry: player.birthCountry,
      age: player.age,
      heightCm: player.heightCm,
      weightKg: player.weightKg,
      birthDate: player.birthDate,
      photoUrl,
      preferredFoot: player.preferredFoot,
      isCaptain: player.isCaptain,
      goals: player.goals,
      assists: player.assists,
      appearances: player.appearances,
      cleanSheets: player.cleanSheets,
      yellowCards: player.yellowCards,
      redCards: player.redCards,
      rating: player.rating ?? null,
      apiFootballPlayerId: player.apiFootballPlayerId,
      club: {
        id: player.club.id,
        name: player.club.name,
        shortName: player.club.shortName,
        primaryColor: player.club.primaryColor,
      },
      seasonScorer: player.scorers[0] || null,
      seasonKeeper: player.keepers[0] || null,
    },
    notes,
    events,
    injuries: injuries.map((i) => ({
      id: i.id,
      status: i.status,
      injuryType: i.injuryType,
      expectedReturn: i.expectedReturn,
      notes: i.notes,
    })),
    afStats,
    afStub,
    career: {
      clubs: careerClubs,
      seasons: careerSeasons,
    },
    recentForm,
    lastGoal: lastGoal
      ? {
          date: lastGoal.date,
          opponent: lastGoal.opponent,
          score: lastGoal.score,
          goals: lastGoal.goals,
          homeAway: lastGoal.homeAway,
        }
      : null,
    transfers,
    afSidelined,
    matchPlayerStats,
    trophies,
    opponentClub,
    clubLogoUrl: player.club.apiFootballTeamId
      ? `https://media.api-sports.io/football/teams/${player.club.apiFootballTeamId}.png`
      : null,
  });
}
