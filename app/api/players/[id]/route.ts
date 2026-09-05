import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { europeanSeasonYear } from "@/lib/season";
import {
  getPlayerById,
  getPlayerTeams,
  getPlayerTransfers,
  getPlayerSidelined,
  getPlayerRecentFixtures,
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

      // Stable call path (avoid turbopack-stale bindings bubbling raw errors)
      const afId = player.apiFootballPlayerId;
      let rows = await withTimeout(getPlayerById(afId, season), 4000);
      if (!rows?.[0]) {
        rows = await withTimeout(getPlayerById(afId, season - 1), 3000);
      }
      afStats = rows?.[0] || null;
      if (!afStats) {
        afStub = "Stats temporarily unavailable";
      } else {
        const row = rows[0] as {
          player?: {
            photo?: string;
            height?: string;
            weight?: string;
            nationality?: string;
            age?: number;
            birth?: { date?: string; country?: string | null };
          };
          statistics?: AfStatRow[];
        };
        const patch: Record<string, unknown> = {};
        if (row.player?.photo && !player.photoUrl) patch.photoUrl = row.player.photo;
        const h = parseCm(row.player?.height);
        if (h && !player.heightCm) patch.heightCm = h;
        const w = parseKg(row.player?.weight);
        if (w && !player.weightKg) patch.weightKg = w;
        if (row.player?.birth?.date && !player.birthDate)
          patch.birthDate = row.player.birth.date;
        const birthCountry = row.player?.birth?.country?.trim() || null;
        if (birthCountry && player.birthCountry !== birthCountry)
          patch.birthCountry = birthCountry;
        const afNat = row.player?.nationality?.trim() || null;
        let nt: string | null = null;
        let bestApps = 0;
        for (const s of row.statistics || []) {
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
        if (row.player?.age && !player.age) patch.age = row.player.age;
        const af = row.statistics?.[0];
        const rt = af?.games?.rating;
        if (rt != null && rt !== "") {
          const n = Number(rt);
          if (Number.isFinite(n)) patch.rating = n;
        }
        if (af?.games?.appearences != null && !player.appearances)
          patch.appearances = af.games.appearences;
        if (af?.goals?.total != null && !player.goals) patch.goals = af.goals.total;
        if (af?.goals?.assists != null && !player.assists)
          patch.assists = af.goals.assists;
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

      // Career: clubs list + a few recent seasons (live AF, short timeouts)
      const teams = await withTimeout(getPlayerTeams(afId), 3500).catch(() => []);
      const seasonYears = [
        season,
        season - 1,
        season - 2,
        season - 3,
        season - 4,
      ];
      const seasonRows: { season: number; statistics: AfStatRow[] }[] = [];
      // Current season already fetched; reuse when present
      if (rows?.[0]?.statistics) {
        seasonRows.push({
          season,
          statistics: (rows[0].statistics || []) as AfStatRow[],
        });
      }
      for (const y of seasonYears) {
        if (seasonRows.some((s) => s.season === y)) continue;
        const block = await withTimeout(getPlayerById(afId, y), 2500).catch(
          () => null
        );
        if (block?.[0]?.statistics?.length) {
          seasonRows.push({
            season: y,
            statistics: block[0].statistics as AfStatRow[],
          });
        }
      }

      // Soft enrichments — never fail the dossier for these
      try {
        const tr = await withTimeout(getPlayerTransfers(afId), 3000).catch(() => []);
        const flat: typeof transfers = [];
        for (const row of tr || []) {
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

      try {
        const sid = await withTimeout(getPlayerSidelined(afId), 2500).catch(() => []);
        afSidelined = (sid || [])
          .map((s) => ({
            type: s.type || "Sidelined",
            start: s.start || null,
            end: s.end || null,
          }))
          .slice(0, 20);
      } catch { /* soft */ }

      try {
        const trop = await withTimeout(getPlayerTrophies(afId), 2500).catch(() => []);
        trophies = (trop || [])
          .map((x) => ({
            league: x.league || "Trophy",
            country: x.country || null,
            season: x.season || null,
            place: x.place || null,
          }))
          .slice(0, 40);
      } catch { /* soft */ }

      try {
        const fxList = await withTimeout(getPlayerRecentFixtures(afId, 6), 3500).catch(
          () => []
        );
        const finished = (fxList || [])
          .filter((fx) =>
            /FT|AET|PEN/i.test(fx.fixture?.status?.short || "")
          )
          .slice(0, 5);
        for (const fx of finished) {
          const home = fx.teams?.home;
          const away = fx.teams?.away;
          const gh = fx.goals?.home;
          const ga = fx.goals?.away;
          // Determine player's side via team id match against career clubs / current club later — use events soft
          let homeAway: "H" | "A" | null = null;
          let result: "W" | "D" | "L" | null = null;
          let opponent = "—";
          let opponentLogo: string | null = null;
          // Prefer matching club AF id
          const clubAf = player.club.apiFootballTeamId;
          if (clubAf && home?.id === clubAf) {
            homeAway = "H";
            opponent = away?.name || "—";
            opponentLogo = away?.logo || null;
            if (gh != null && ga != null) {
              result = gh > ga ? "W" : gh < ga ? "L" : "D";
            }
          } else if (clubAf && away?.id === clubAf) {
            homeAway = "A";
            opponent = home?.name || "—";
            opponentLogo = home?.logo || null;
            if (gh != null && ga != null) {
              result = ga > gh ? "W" : ga < gh ? "L" : "D";
            }
          } else {
            opponent = `${home?.name || "?"} vs ${away?.name || "?"}`;
          }
          let rating: string | null = null;
          let started: boolean | null = null;
          let minutes: number | null = null;
          let goals: number | null = null;
          let assists: number | null = null;
          let yellow: number | null = null;
          let red: number | null = null;
          try {
            const fp = await withTimeout(getFixturePlayers(fx.fixture.id), 2500).catch(
              () => null
            );
            if (fp) {
              for (const teamBlock of fp) {
                for (const pl of teamBlock.players || []) {
                  if (pl.player?.id !== afId) continue;
                  const st = pl.statistics?.[0];
                  rating = st?.games?.rating != null ? String(st.games.rating) : null;
                  started = st?.games?.substitute === true ? false : st?.games?.minutes != null ? true : null;
                  if (st?.games?.substitute === false) started = true;
                  minutes = st?.games?.minutes ?? null;
                  goals = st?.goals?.total ?? null;
                  assists = st?.goals?.assists ?? null;
                  yellow = st?.cards?.yellow ?? null;
                  red = st?.cards?.red ?? null;
                  if (teamBlock.team?.id === home?.id) homeAway = "H";
                  if (teamBlock.team?.id === away?.id) homeAway = "A";
                  if (gh != null && ga != null && homeAway) {
                    if (homeAway === "H") result = gh > ga ? "W" : gh < ga ? "L" : "D";
                    else result = ga > gh ? "W" : ga < gh ? "L" : "D";
                    opponent = homeAway === "H" ? away?.name || "—" : home?.name || "—";
                    opponentLogo = homeAway === "H" ? away?.logo || null : home?.logo || null;
                  }
                }
              }
            }
          } catch { /* soft */ }
          recentForm.push({
            date: fx.fixture?.date || "",
            opponent,
            opponentLogo,
            league: fx.league?.name || null,
            leagueLogo: (fx.league as { logo?: string } | undefined)?.logo || null,
            result,
            homeAway,
            score:
              gh != null && ga != null ? `${gh}-${ga}` : "—",
            rating,
            started,
            minutes,
            goals,
            assists,
            yellow,
            red,
          });
        }
      } catch { /* soft */ }

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
