import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { MatchDesk } from "@/components/match/match-desk";
import { formatKickoff } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export default async function MatchOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const referee = match.officials.find((o) => o.role === "Referee")?.official
    .name;

  const packCount = await prisma.packSection.count({ where: { matchId: id } });

  return (
    <MatchDesk
      matchId={match.id}
      homeName={match.homeClub.shortName}
      awayName={match.awayClub.shortName}
      homeFullName={match.homeClub.name}
      awayFullName={match.awayClub.name}
      homeColor={match.homeClub.primaryColor}
      awayColor={match.awayClub.primaryColor}
      homeFormation={match.homeFormation}
      awayFormation={match.awayFormation}
      homePlayers={match.homeClub.players}
      awayPlayers={match.awayClub.players}
      homeCoach={match.homeClub.coaches[0]}
      awayCoach={match.awayClub.coaches[0]}
      referee={referee}
      lineupStatus={match.lineupStatus}
      apiFootballFixtureId={match.apiFootballFixtureId}
      lastFeedSyncAt={match.lastFeedSyncAt}
      status={match.status}
      kickoffLabel={formatKickoff(match.kickoff)}
      competition={match.matchDay.competition}
      homeScore={match.homeScore}
      awayScore={match.awayScore}
      minute={match.minute}
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
    />
  );
}
