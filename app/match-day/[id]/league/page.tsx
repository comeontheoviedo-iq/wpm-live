import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { playingColorsForMatch } from "@/lib/kit-colors";
import { LeagueIntel } from "@/components/match/league-intel";
import { AdvancedStatsCard } from "@/components/match/advanced-stats-card";

export default async function MatchLeaguePage({
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
      <AdvancedStatsCard
        matchId={match.id}
        homeName={match.homeClub.shortName}
        awayName={match.awayClub.shortName}
        homeColor={homeColor}
        awayColor={awayColor}
        compact
        showCoverage
      />
      <LeagueIntel matchId={match.id} />
    </div>
  );
}
