import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { ObsOverlayClient } from "./overlay-client";

export const dynamic = "force-dynamic";

export default async function ObsOverlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <ObsOverlayClient
      matchId={match.id}
      matchDayId={match.matchDayId}
      homeName={match.homeClub.shortName}
      awayName={match.awayClub.shortName}
      homeAbbr={match.homeClub.abbreviation}
      awayAbbr={match.awayClub.abbreviation}
      homeColor={match.homeClub.primaryColor}
      awayColor={match.awayClub.primaryColor}
      homeTeamAfId={match.homeClub.apiFootballTeamId}
      awayTeamAfId={match.awayClub.apiFootballTeamId}
      competition={match.matchDay.competition}
      apiFootballFixtureId={match.apiFootballFixtureId}
      status={match.status}
      homeScore={match.homeScore}
      awayScore={match.awayScore}
      minute={match.minute}
      minuteExtra={(match as { minuteExtra?: number | null }).minuteExtra ?? null}
      events={match.events.map((e) => ({
        id: e.id,
        type: e.type,
        minute: e.minute,
        description: e.description,
        teamSide: e.teamSide,
      }))}
      statistics={match.statistics.map((s) => ({
        label: s.label,
        homeValue: s.homeValue,
        awayValue: s.awayValue,
      }))}
    />
  );
}
