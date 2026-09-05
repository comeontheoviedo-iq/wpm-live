import { notFound } from "next/navigation";
import { getMatchFull } from "@/lib/match-data";
import { ClubsTabClient } from "@/components/match/clubs-tab-client";

export default async function ClubsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchFull(id);
  if (!match) notFound();

  return (
    <ClubsTabClient
      matchId={match.id}
      home={{
        id: match.homeClub.id,
        name: match.homeClub.name,
        shortName: match.homeClub.shortName,
        primaryColor: match.homeClub.primaryColor,
        apiFootballTeamId: match.homeClub.apiFootballTeamId,
      }}
      away={{
        id: match.awayClub.id,
        name: match.awayClub.name,
        shortName: match.awayClub.shortName,
        primaryColor: match.awayClub.primaryColor,
        apiFootballTeamId: match.awayClub.apiFootballTeamId,
      }}
    />
  );
}
