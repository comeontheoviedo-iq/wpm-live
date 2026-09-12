import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { playingColorsForMatch } from "@/lib/kit-colors";
import { MatchDesk } from "@/components/match/match-desk";
import { formatKickoff } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MatchOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const { homeColor, awayColor, homeKit, awayKit } =
    playingColorsForMatch(match);

  const refOfficial = match.officials.find((o) => o.role === "Referee")?.official;
  const referee = refOfficial?.name;
  const refereeNationality = refOfficial?.nationality ?? null;

  const packCount = await prisma.packSection.count({ where: { matchId: match.id } });

  const scorersRaw = await prisma.seasonScorer.findMany({
    where: { clubId: { in: [match.homeClubId, match.awayClubId] } },
    orderBy: { rank: "asc" },
    include: { player: true, club: true },
    take: 12,
  });
  const keepersRaw = await prisma.seasonKeeper.findMany({
    where: { clubId: { in: [match.homeClubId, match.awayClubId] } },
    orderBy: { rank: "asc" },
    include: { player: true, club: true },
    take: 8,
  });

  const sideOf = (clubId: string) =>
    clubId === match.homeClubId
      ? ("home" as const)
      : clubId === match.awayClubId
        ? ("away" as const)
        : ("other" as const);

  return (
    <MatchDesk
      matchId={match.id}
      homeName={match.homeClub.shortName}
      awayName={match.awayClub.shortName}
      homeFullName={match.homeClub.name}
      awayFullName={match.awayClub.name}
      homeAbbr={match.homeClub.abbreviation}
      awayAbbr={match.awayClub.abbreviation}
      homeColor={homeColor}
      awayColor={awayColor}
      homeKit={homeKit}
      awayKit={awayKit}
      homeFormation={match.homeFormation}
      awayFormation={match.awayFormation}
      homePlayers={match.homeClub.players}
      awayPlayers={match.awayClub.players}
      homeCoach={match.homeClub.coaches[0]}
      awayCoach={match.awayClub.coaches[0]}
      referee={referee}
      refereeNationality={refereeNationality}
      lineupStatus={match.lineupStatus}
      apiFootballFixtureId={match.apiFootballFixtureId}
      lastFeedSyncAt={match.lastFeedSyncAt}
      status={match.status}
      kickoffLabel={formatKickoff(match.kickoff)}
      kickoffAt={match.kickoff.toISOString()}
      competition={match.matchDay.competition}
      homeScore={match.homeScore}
      awayScore={match.awayScore}
      minute={match.minute}
      minuteExtra={(match as { minuteExtra?: number | null }).minuteExtra ?? null}
      period={(match as { period?: string | null }).period ?? null}
      notes={match.notes.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        category: n.category,
        entityType: n.entityType,
        entityId: n.entityId,
        pinned: n.pinned,
      }))}
      injuryCount={match.injuries.length}
      predictionsAdvice={match.predictionsAdvice}
      predictionsJson={match.predictionsJson}
      h2hSummary={match.h2hSummary}
      packCount={packCount}
      venueName={match.venue?.name}
      venueCity={match.venue?.city}
      venueCapacity={match.venue?.capacity}
      attendance={match.attendance ?? null}
      weatherSummary={match.weatherSummary}
      weatherTempC={match.weatherTempC}
      weatherWindKph={match.weatherWindKph}
      weatherHumidity={match.weatherHumidity}
      events={match.events.map((e) => ({
        id: e.id,
        type: e.type,
        minute: e.minute,
        description: e.description,
        teamSide: e.teamSide,
        playerId: e.playerId,
      }))}
      statistics={match.statistics.map((s) => ({
        label: s.label,
        homeValue: s.homeValue,
        awayValue: s.awayValue,
      }))}
      scorers={scorersRaw.map((s) => ({
        id: s.id,
        goals: s.goals,
        assists: s.assists,
        rank: s.rank,
        playerName: s.player.name,
        clubShort: s.club.shortName,
        side: sideOf(s.clubId),
      }))}
      keepers={keepersRaw.map((k) => ({
        id: k.id,
        cleanSheets: k.cleanSheets,
        saves: k.saves,
        appearances: k.appearances,
        rank: k.rank,
        playerName: k.player.name,
        clubShort: k.club.shortName,
        side: sideOf(k.clubId),
      }))}
      homeClubId={match.homeClubId}
      awayClubId={match.awayClubId}
      homeTeamAfId={match.homeClub.apiFootballTeamId}
      awayTeamAfId={match.awayClub.apiFootballTeamId}
      playerOverrides={match.playerOverrides.map((o) => ({
        playerId: o.playerId,
        displayName: o.displayName,
        pronunciation: o.pronunciation,
        pitchFlag: o.pitchFlag,
        jerseyNumber: o.jerseyNumber,
        formationSlot: o.formationSlot,
        pitchX: o.pitchX,
        pitchY: o.pitchY,
      }))}
    />
  );
}
