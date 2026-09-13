/**
 * Enrich live event detail panels with AF-backed form / sidelined / season rows.
 * Prefer DB + desk; fan-in via afFetch TTLs. Soft-fail unknown fields as null.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPlayerById,
  getPlayerFormViaTeam,
  getPlayerSidelined,
} from "@/lib/api-football";
import { europeanSeasonYear } from "@/lib/season";
import { leagueIdForMatchDay } from "@/lib/competitions";
import {
  splitSeasonStats,
  liveAdjustedSeasonStat,
  seasonOrdinal,
} from "@/lib/season-tally";
import {
  benchImpactFromForm,
  buildGoalNarrativeHooks,
  eventDetailKind,
  findPreviousGoal,
  suspensionProximity,
  type EventDetailKind,
} from "@/lib/event-detail";

export const dynamic = "force-dynamic";

type Body = {
  kind?: string;
  type?: string;
  playerId?: string | null;
  afPlayerId?: number | null;
  teamAfId?: number | null;
  opponentName?: string | null;
  /** When true, pull form (extra AF). Default true for goal/sub; false for cards if budget-sensitive. */
  includeForm?: boolean;
  matchStatus?: string | null;
  inMatchGoals?: number;
  inMatchAssists?: number;
  inMatchYellows?: number;
  inMatchReds?: number;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: matchId } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      matchDay: true,
      homeClub: true,
      awayClub: true,
    },
  });
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const kind: EventDetailKind | null =
    eventDetailKind(body.type || "") ||
    (body.kind as EventDetailKind | undefined) ||
    null;

  const playerId = body.playerId || null;
  let player = playerId
    ? await prisma.player.findUnique({ where: { id: playerId } })
    : null;

  if (!player && body.afPlayerId) {
    player = await prisma.player.findFirst({
      where: {
        apiFootballPlayerId: body.afPlayerId,
        clubId: { in: [match.homeClubId, match.awayClubId] },
      },
    });
  }

  const competition = match.matchDay.competition;
  const leagueAfId = leagueIdForMatchDay(match.matchDay);
  const season = europeanSeasonYear(match.kickoff);
  const matchStatus = body.matchStatus || match.status;
  const afId = player?.apiFootballPlayerId ?? body.afPlayerId ?? null;

  const teamAfId =
    body.teamAfId ??
    (player
      ? player.clubId === match.homeClubId
        ? match.homeClub.apiFootballTeamId
        : player.clubId === match.awayClubId
          ? match.awayClub.apiFootballTeamId
          : null
      : null);

  const inMatchGoals = Math.max(0, Number(body.inMatchGoals) || 0);
  const inMatchAssists = Math.max(0, Number(body.inMatchAssists) || 0);
  const inMatchYellows = Math.max(0, Number(body.inMatchYellows) || 0);
  const inMatchReds = Math.max(0, Number(body.inMatchReds) || 0);

  let goalsCompetition: number | null = player?.goals ?? null;
  let goalsAll: number | null = player?.goalsAllComps ?? null;
  let assistsCompetition: number | null = player?.assists ?? null;
  let assistsAll: number | null = player?.assistsAllComps ?? null;
  let yellows: number | null = player?.yellowCards ?? null;
  let reds: number | null = player?.redCards ?? null;
  let afSource: "db" | "af" | "none" = player ? "db" : "none";

  // One /players call — TTL-cached in api-football
  if (afId && leagueAfId) {
    try {
      const rows = await getPlayerById(afId, season);
      const stats = rows[0]?.statistics;
      if (stats?.length) {
        const split = splitSeasonStats(
          stats,
          leagueAfId,
          competition,
          teamAfId
        );
        if (split.competitionGoals != null) goalsCompetition = split.competitionGoals;
        if (split.allCompGoals != null) goalsAll = split.allCompGoals;
        if (split.competitionAssists != null)
          assistsCompetition = split.competitionAssists;
        if (split.allCompAssists != null) assistsAll = split.allCompAssists;
        // Cards: sum club rows for this season (non-friendly)
        let y = 0;
        let r = 0;
        let anyCard = false;
        for (const s of stats) {
          if (teamAfId != null && s.team?.id !== teamAfId) continue;
          if (/\bfriendl/i.test(s.league?.name || "")) continue;
          if (s.cards?.yellow != null) {
            y += s.cards.yellow;
            anyCard = true;
          }
          if (s.cards?.red != null) {
            r += s.cards.red;
            anyCard = true;
          }
        }
        if (anyCard) {
          yellows = y;
          reds = r;
        }
        afSource = "af";
      }
    } catch {
      /* soft-fail — keep DB */
    }
  }

  const deskGoals = player?.goals ?? null;
  const deskAssists = player?.assists ?? null;
  const deskYellows = player?.yellowCards ?? null;
  const deskReds = player?.redCards ?? null;

  const goalsCompetitionNow = liveAdjustedSeasonStat(
    goalsCompetition,
    inMatchGoals,
    matchStatus,
    { deskBaseline: deskGoals }
  );
  const goalsAllNow = liveAdjustedSeasonStat(goalsAll, inMatchGoals, matchStatus, {
    deskBaseline: player?.goalsAllComps ?? deskGoals,
  });
  const assistsCompetitionNow = liveAdjustedSeasonStat(
    assistsCompetition,
    inMatchAssists,
    matchStatus,
    { deskBaseline: deskAssists }
  );
  const assistsAllNow = liveAdjustedSeasonStat(
    assistsAll,
    inMatchAssists,
    matchStatus,
    { deskBaseline: player?.assistsAllComps ?? deskAssists }
  );
  const yellowsNow = liveAdjustedSeasonStat(
    yellows,
    inMatchYellows,
    matchStatus,
    { deskBaseline: deskYellows }
  );
  const redsNow = liveAdjustedSeasonStat(reds, inMatchReds, matchStatus, {
    deskBaseline: deskReds,
  });
  // Ordinal for this event — same AF base as the NOW tally (never double-count)
  const competitionOrdinal =
    kind === "goal" && inMatchGoals > 0
      ? seasonOrdinal(
          goalsCompetition,
          inMatchGoals,
          inMatchGoals,
          // When AF already includes today, treat as FT-style for ordinal math
          goalsCompetition != null &&
            deskGoals != null &&
            goalsCompetition >= deskGoals + inMatchGoals
            ? "Full Time"
            : matchStatus
        )
      : null;

  const wantForm =
    body.includeForm !== false &&
    (kind === "goal" || kind === "sub" || kind == null);

  let previousGoal: ReturnType<typeof findPreviousGoal> = null;
  let narratives: ReturnType<typeof buildGoalNarrativeHooks> = [];
  let bench: ReturnType<typeof benchImpactFromForm> | null = null;
  let formSampleSize = 0;
  let formError: string | null = null;

  const kickoffIso = match.kickoff instanceof Date ? match.kickoff.toISOString() : String(match.kickoff || "");
  const excludeDatePrefix = kickoffIso.slice(0, 10) || null;
  const excludeFixtureId = match.apiFootballFixtureId ?? null;

  if (wantForm && afId && teamAfId) {
    try {
      const form = await getPlayerFormViaTeam(afId, teamAfId, 6);
      formSampleSize = form.length;
      previousGoal = findPreviousGoal(form, {
        asOf: new Date(),
        excludeFixtureId,
        excludeDatePrefix,
      });
      if (kind === "goal" || !kind) {
        narratives = buildGoalNarrativeHooks({
          form,
          opponentName: body.opponentName || null,
          includeThisGoal: inMatchGoals > 0,
          excludeFixtureId,
          excludeDatePrefix,
        });
      }
      if (kind === "sub" || !kind) {
        bench = benchImpactFromForm(form);
      }
    } catch {
      formError = "Recent form unavailable from feed";
    }
  }

  let suspensionsThisSeason: {
    type: string;
    start: string | null;
    end: string | null;
  }[] = [];
  if (afId && (kind === "yellow" || kind === "red" || kind == null)) {
    try {
      const side = await getPlayerSidelined(afId);
      const seasonStart = `${season}-07-01`;
      suspensionsThisSeason = (side || [])
        .filter((s) => {
          const typ = String(s.type || "").toLowerCase();
          // Drop clear injuries/illness; keep suspension / ban / card bans
          if (/injur|knock|strain|fracture|illness|virus|covid|surgery|hamstring|ankle|knee|muscle/i.test(typ)) {
            return false;
          }
          if (!/suspen|ban|red|yellow|card|dismiss/i.test(typ)) return false;
          const start = s.start || "";
          return !start || start >= seasonStart;
        })
        .map((s) => ({
          type: s.type || "Suspension",
          start: s.start || null,
          end: s.end || null,
        }))
        .slice(0, 8);
    } catch {
      /* soft */
    }
  }

  return NextResponse.json({
    ok: true,
    afSource,
    competition,
    leagueAfId,
    season,
    player: player
      ? {
          id: player.id,
          name: player.name,
          photoUrl: player.photoUrl,
          apiFootballPlayerId: player.apiFootballPlayerId,
          position: player.position,
          birthDate: player.birthDate,
          age: player.age,
        }
      : null,
    goalsCompetitionNow,
    goalsAllCompsNow: goalsAllNow,
    competitionOrdinal,
    assistsCompetitionNow,
    assistsAllCompsNow: assistsAllNow,
    yellowsNow,
    redsNow,
    suspension: suspensionProximity(yellowsNow, leagueAfId),
    previousGoal,
    narratives,
    bench,
    formSampleSize,
    formError,
    suspensionsThisSeason,
  });
}
