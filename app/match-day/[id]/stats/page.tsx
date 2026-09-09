import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { playingColorsForMatch } from "@/lib/kit-colors";
import { formatKickoff } from "@/lib/utils";
import { MatchStatisticsView } from "@/components/match/match-statistics";
import { AdvancedStatsCard } from "@/components/match/advanced-stats-card";

export default async function MatchStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  const { homeColor, awayColor } = playingColorsForMatch(match);

  return (
    <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 space-y-3">
      <div>
        <h1 className="text-lg font-bold">Match Statistics</h1>
        <p className="text-xs text-slate-500">
          Score, scorers, attendance, and key team lines — then deep stats.
        </p>
      </div>

      {/* Unmistakable above-fold overview first */}
      <MatchStatisticsView
        homeName={match.homeClub.shortName}
        awayName={match.awayClub.shortName}
        homeColor={homeColor}
        awayColor={awayColor}
        homeScore={match.homeScore}
        awayScore={match.awayScore}
        status={match.status}
        competition={match.matchDay.competition}
        kickoffLabel={formatKickoff(match.kickoff)}
        venueName={match.venue?.name}
        venueCity={match.venue?.city}
        attendance={match.attendance ?? null}
        venueCapacity={match.venue?.capacity ?? null}
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

      <AdvancedStatsCard
        matchId={match.id}
        homeName={match.homeClub.shortName}
        awayName={match.awayClub.shortName}
        homeColor={homeColor}
        awayColor={awayColor}
        showCoverage
      />
    </div>
  );
}
