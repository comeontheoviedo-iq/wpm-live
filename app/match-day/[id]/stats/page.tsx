import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { formatKickoff } from "@/lib/utils";
import { MatchStatisticsView } from "@/components/match/match-statistics";

export default async function MatchStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 space-y-3">
      <div>
        <h1 className="text-lg font-bold">Match Statistics</h1>
        <p className="text-xs text-slate-500">
          Possession, shots, corners and the event timeline — SportsCom-style.
        </p>
      </div>
      <MatchStatisticsView
        homeName={match.homeClub.shortName}
        awayName={match.awayClub.shortName}
        homeColor={match.homeClub.primaryColor}
        awayColor={match.awayClub.primaryColor}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        status={match.status}
        competition={match.matchDay.competition}
        kickoffLabel={formatKickoff(match.kickoff)}
        venueName={match.venue?.name}
        venueCity={match.venue?.city}
        statistics={match.statistics.map((s) => ({
          label: s.label,
          homeValue: s.homeValue,
          awayValue: s.awayValue,
        }))}
        events={match.events.map((e) => ({
          id: e.id,
          type: e.type,
          minute: e.minute,
          description: e.description,
          teamSide: e.teamSide,
          playerId: e.playerId,
        }))}
      />
    </div>
  );
}
